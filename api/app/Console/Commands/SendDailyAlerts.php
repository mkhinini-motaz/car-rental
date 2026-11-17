<?php

namespace App\Console\Commands;

use App\Models\Agency;
use App\Models\Car;
use App\Models\Contract;
use App\Models\DeviceToken;
use App\Support\Push;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

/**
 * The morning push to every signed-in phone of each agency: today's pickups and returns and the
 * cars overdue, then each paper (insurance, vignette, visite technique) ending in 30, 7 or 1
 * days, or today. Scheduled daily at 08:00, Tunis time (routes/console.php).
 */
class SendDailyAlerts extends Command
{
    protected $signature = 'alerts:daily';

    protected $description = "Push today's movements, overdue cars and expiring papers to the agencies' phones";

    const PAPER_DAYS = [ 30, 7, 1, 0 ];
    const PAPERS = [ 'insurance_ends_at' => 'insurance', 'circulation_tax_ends_at' => 'circulation_tax', 'technical_control_ends_at' => 'technical_control' ];

    public function handle(Push $push): void
    {
        $today = CarbonImmutable::now(Agency::TIMEZONE)->startOfDay();
        $from = $today->getTimestamp();
        $to = $today->addDay()->getTimestamp();

        Agency::whereHas('deviceTokens')->with('deviceTokens')->each(function (Agency $agency) use ($push, $today, $from, $to) {
            $devices = $agency->deviceTokens;
            $movements = [
                'pickups' => $agency->contracts()->where('contracts.status', Contract::STATUS_RESERVED)->where('starts_at', '>=', $from)->where('starts_at', '<', $to)->count(),
                'returns' => $agency->contracts()->where('contracts.status', Contract::STATUS_OUT)->where('ends_at', '>=', $from)->where('ends_at', '<', $to)->count(),
                'overdue' => $agency->contracts()->where('contracts.status', Contract::STATUS_OUT)->where('ends_at', '<', time())->count(),
            ];
            if (array_sum($movements)) {
                $devices->each(fn (DeviceToken $device) => $push->send(
                    $device, __('alerts.today.title', [], $device->lang), __('alerts.today.body', $movements, $device->lang), [ 'screen' => 'Today' ],
                ));
            }

            foreach ($agency->cars()->inFleet()->get() as $car) {
                foreach (self::PAPERS as $column => $paper) {
                    if ($car->$column === null) {
                        continue;
                    }
                    $days = (int) $today->diffInDays(CarbonImmutable::createFromTimestamp($car->$column, Agency::TIMEZONE)->startOfDay(), false);
                    if (! in_array($days, self::PAPER_DAYS, true)) {
                        continue;
                    }
                    $devices->each(fn (DeviceToken $device) => $push->send($device, __('alerts.paper.title', [], $device->lang), __($days ? 'alerts.paper.ends_in' : 'alerts.paper.ends_today', [
                        'paper' => __('alerts.paper.' . $paper, [], $device->lang),
                        'plate' => Car::embedPlate($car->licence_plate),
                        'days' => $days,
                    ], $device->lang), [ 'car_id' => $car->id ]));
                }
            }
        });
    }
}
