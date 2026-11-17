<?php

namespace App\Http\Controllers;

use App\Http\Requests\CarRequest;
use App\Http\Resources\CarBlockResource;
use App\Http\Resources\CarResource;
use App\Http\Resources\ContractDamageResource;
use App\Http\Resources\ResourceCollection;
use App\Models\Car;
use App\Models\CarBlock;
use App\Models\Contract;
use App\Models\ContractPhoto;
use App\Models\Expense;
use App\Models\Payment;
use App\Support\CarMoney;
use App\Support\MonthlyReport;
use App\Models\Agency;
use Carbon\CarbonImmutable;
use App\Support\Pricing;
use App\Repositories\CarRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Storage;
use function App\Support\Helpers\uploadFile;

class CarController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $request->validate([
            'page'           => 'integer|min:1',
            'perPage'        => 'integer|min:1|max:100',
            'search'         => 'nullable|string|max:100',
            'orderBy'        => 'in:created_at,daily_price,manufacturer,model_name,model_year,licence_plate',
            'orderDirection' => 'in:asc,desc',
            'starts_at'      => 'nullable|required_with:ends_at|integer|min:0',
            'ends_at'        => 'nullable|required_with:starts_at|integer|gt:starts_at',
            'sold'           => 'boolean', // the sold cars instead of the fleet
        ]);

        $cars = CarRepository::paginate(
            $request->user()->agency,
            $request->integer('page', 1),
            $request->integer('perPage', 20),
            $request->input('search'),
            $request->input('orderBy', 'created_at'),
            $request->input('orderDirection', 'desc'),
            $request->filled('starts_at') ? $request->integer('starts_at') : null,
            $request->filled('ends_at') ? $request->integer('ends_at') : null,
            $request->boolean('sold'),
        );

        return ResourceCollection::jsonResponse($cars);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()
            ->with([
                'contracts' => fn ($query) => $query->with('client')->orderByDesc('starts_at'),
                'expenses' => fn ($query) => $query->orderByDesc('spent_at'),
                'incomes' => fn ($query) => $query->orderByDesc('received_at'),
                'documents',
                'damages' => fn ($query) => $query->orderByDesc('contract_damages.id'),
            ])
            ->findOrFail($carId);

        $car->oil_change = $car->oilChange();
        if ($request->user()->isOwner()) {
            // Earned: rentals that happened (handed over), not bookings. Spent: running costs (not the
            // instalments, which pay for the car) and the fines the agency bore. See CarMoney.
            $money = CarMoney::of($car);
            $car->revenue = $money['earned'];
            $car->expenses_total = $money['running_total'];
            $car->profit = $money['earned'] + $money['other_income'] - $money['running_total'];
            $monthStart = CarbonImmutable::now(Agency::TIMEZONE)->startOfMonth();
            $car->money = [
                ...$money,
                'cost_per_km' => MonthlyReport::costPerKm($car),
                'this_month' => MonthlyReport::carDays($car, $car->contracts, $monthStart, $monthStart->addMonth()),
            ];
        } else {
            // Managers see the running costs they log, not what the car earns or how it's paid for.
            $car->setRelation('expenses', $car->expenses->where('category', '!=', Expense::CATEGORY_INSTALMENT)->values());
            $car->unsetRelation('incomes');
        }

        return new CarResource($car);
    }

    /**
     * What the car cost and how it's paid for: price, fees, supplier, and a credit or leasing
     * (advance, monthly instalment, number of months, first due date, instalments already paid
     * before the app, lender). Owner only.
     */
    public function updatePurchase(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->findOrFail($carId);
        $data = $request->validate([
            'purchase_price'      => 'nullable|integer|min:0|max:1000000000',
            'bought_at'           => 'nullable|integer|min:0',
            'purchase_fees'       => 'sometimes|integer|min:0|max:100000000',
            'supplier'            => 'nullable|string|max:100',
            'advance'             => 'nullable|integer|min:0|max:1000000000',
            'instalment_amount'   => 'nullable|required_with:instalment_months|integer|min:1|max:100000000',
            'instalment_months'   => 'nullable|required_with:instalment_amount|integer|min:1|max:120',
            'first_instalment_at' => 'nullable|integer|min:0',
            'instalments_paid_before' => 'sometimes|integer|min:0|max:120', // on paper, before the car came into the app
            'earned_before'       => 'nullable|integer|min:0|max:1000000000', // what it brought in before the app, after its costs
            'lender'              => 'nullable|string|max:100',
            'expected_sale_price' => 'nullable|integer|min:0|max:1000000000',
        ]);
        $car->forceFill($data)->save();

        return $this->show($request, $car->id);
    }

    /**
     * Sells the car: it leaves the fleet, the planning and availability, keeps its history, and a
     * cash sale goes in the cash book. Refused while a rental is booked or out. Owner only.
     */
    public function storeSale(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->inFleet()->findOrFail($carId);
        $data = $request->validate([
            'sale_price'  => 'required|integer|min:0|max:1000000000',
            'sold_at'     => 'nullable|integer|min:0',
            'buyer_name'  => 'required|string|max:100',
            'buyer_phone' => [ 'nullable', 'string', 'regex:/^\+216[234579]\d{7}$/' ],
            'sale_method' => [ 'required', Rule::in(Payment::METHODS) ],
        ]);
        if ($car->contracts()->whereIn('status', [ Contract::STATUS_RESERVED, Contract::STATUS_OUT ])->exists()) {
            throw ValidationException::withMessages([ 'car' => 'car:sale:busy' ]);
        }
        $car->forceFill([ ...$data, 'sold_at' => $data['sold_at'] ?? time(), 'status' => Car::STATUS_SOLD ])->save();

        return $this->show($request, $car->id);
    }

    /**
     * Undoes a sale recorded by mistake: the car is back in the fleet.
     */
    public function destroySale(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->whereNotNull('sold_at')->findOrFail($carId);
        $car->forceFill([ ...array_fill_keys(Car::SALE_FIELDS, null), 'status' => Car::STATUS_AVAILABLE ])->save();

        return $this->show($request, $car->id);
    }

    /**
     * The suggested daily price for a rental, from the agency's pricing rules.
     */
    public function quote(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->findOrFail($carId);
        $request->validate([
            'starts_at' => 'required|integer|min:0',
            'ends_at'   => 'required|integer|gt:starts_at',
        ]);

        return response()->json([ 'data' => Pricing::quote($request->user()->agency, $car, $request->integer('starts_at'), $request->integer('ends_at')) ]);
    }

    /**
     * The fleet over a period, for the planning board: every car with its contracts (client
     * included) and blocks in [starts_at, ends_at). At most two months at a time.
     */
    public function planning(Request $request)
    {
        $request->validate([
            'starts_at' => 'required|integer|min:0',
            'ends_at'   => 'required|integer|gt:starts_at|lte:' . ($request->integer('starts_at') + 62 * 24 * 60 * 60),
        ]);
        $startsAt = $request->integer('starts_at');
        $endsAt = $request->integer('ends_at');

        $cars = $request->user()->agency->cars()
            ->where(fn ($query) => $query->whereNull('sold_at')->orWhere('sold_at', '>', $startsAt)) // sold before: gone
            ->with([
                // A car still out after its end date is still out: overdue rentals show up to now.
                'contracts' => fn ($query) => $query->where(fn ($query) => $query->overlapping($startsAt, $endsAt)
                    ->orWhere(fn ($query) => $query->where('status', Contract::STATUS_OUT)->where('starts_at', '<', $endsAt)))
                    ->with('client')->orderBy('starts_at'),
                'blocks' => fn ($query) => $query->overlapping($startsAt, $endsAt)->orderBy('starts_at'),
            ])
            ->orderBy('manufacturer')->orderBy('model_name')
            ->get();

        return CarResource::collection($cars);
    }

    /**
     * Takes the car off the planning for a while (maintenance, personal use). Refused when a
     * contract or another block is in the way.
     */
    public function storeBlock(Request $request, $carId)
    {
        $data = $request->validate([
            'starts_at' => 'required|integer|min:0',
            'ends_at'   => 'required|integer|gt:starts_at',
            'reason'    => [ 'required', Rule::in(CarBlock::REASONS) ],
            'note'      => 'nullable|string|max:255',
        ]);

        $block = DB::transaction(function () use ($request, $carId, $data) {
            $car = $request->user()->agency->cars()->lockForUpdate()->findOrFail($carId);
            $isTaken = $car->contracts()->overlapping($data['starts_at'], $data['ends_at'])->exists()
                || $car->blocks()->overlapping($data['starts_at'], $data['ends_at'])->exists();
            if ($isTaken) {
                throw ValidationException::withMessages([ 'starts_at' => 'contract:overlap' ]);
            }

            return $car->blocks()->create($data);
        });

        return (new CarBlockResource($block))->response()->setStatusCode(201);
    }

    public function destroyBlock(Request $request, $carId, $blockId)
    {
        $request->user()->agency->cars()->findOrFail($carId)->blocks()->findOrFail($blockId)->delete();

        return response()->noContent();
    }

    /**
     * Damage already on the car, marked on its outline outside a handover: a car that came into the
     * app with its scratches, before its first pickup here. No rental is behind it, so nobody is
     * charged for it; its next handovers show it until it is repaired.
     */
    public function storeDamages(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->inFleet()->findOrFail($carId);
        $data = $request->validate([
            'damages'        => 'required|array|min:1|max:30',
            'damages.*.x'    => 'required|integer|min:0|max:1000',
            'damages.*.y'    => 'required|integer|min:0|max:1000',
            'damages.*.note' => 'nullable|string|max:255',
        ]);

        return ContractDamageResource::collection($car->damages()->createMany($data['damages']))->response()->setStatusCode(201);
    }

    /**
     * Marks a damage on the car repaired, so the next handovers stop showing it. With an amount, the
     * repair is also the car's expense, counted against the renter when the damage was found at a return.
     */
    public function repairDamage(Request $request, $carId, $damageId)
    {
        $car = $request->user()->agency->cars()->findOrFail($carId);
        $damage = $car->damages()->whereNull('repaired_at')->findOrFail($damageId);
        $data = $request->validate([
            'repaired_at' => 'required|integer|min:0|max:' . (time() + 5 * 60),
            'amount'      => 'nullable|integer|min:1|max:100000000',
            'method'      => [ 'sometimes', Rule::in(Payment::METHODS) ], // cash by default, as any expense
            'garage'      => 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($request, $car, $damage, $data) {
            $damage->update([ 'repaired_at' => $data['repaired_at'] ]);
            if (! empty($data['amount'])) {
                $request->user()->agency->expenses()->create([
                    ...collect($data)->only([ 'amount', 'method', 'garage' ])->all(),
                    'category' => Expense::CATEGORY_REPAIR,
                    'spent_at' => $data['repaired_at'],
                    'note' => $damage->note,
                    'car_id' => $car->id,
                    'contract_id' => $damage->stage === ContractPhoto::STAGE_RETURN ? $damage->contract_id : null,
                    'user_id' => $request->user()->id,
                ]);
            }
        });

        return new ContractDamageResource($damage);
    }

    public function store(CarRequest $request)
    {
        $car = $request->user()->agency->cars()->create($request->validated());

        return (new CarResource($car->refresh()))->response()->setStatusCode(201);
    }

    public function update(CarRequest $request, $carId)
    {
        $car = $request->user()->agency->cars()->findOrFail($carId);
        // A sold car stays sold: only the sale's undo brings it back.
        $car->update(collect($request->validated())->except($car->sold_at ? [ 'status' ] : [])->all());

        return new CarResource($car);
    }

    /**
     * One photo per car, so staff recognise it in lists. A new one replaces the old one.
     */
    public function photo(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->findOrFail($carId);
        $request->validate([ 'photo' => 'required|image|max:8192' ]);

        $oldPhoto = $car->photo;
        $car->update([ 'photo' => uploadFile($request->file('photo'), "cars/{$car->id}") ]);
        if ($oldPhoto) {
            Storage::delete($oldPhoto);
        }

        return new CarResource($car);
    }
}
