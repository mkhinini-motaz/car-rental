<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClientRequest;
use App\Http\Resources\ClientResource;
use App\Http\Resources\ResourceCollection;
use App\Models\Client;
use App\Support\ClientStats;
use Illuminate\Http\Request;

use function App\Support\Helpers\firstNameLastNameLike;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'page'           => 'integer|min:1',
            'perPage'        => 'integer|min:1|max:100',
            'search'         => 'nullable|string|max:100',
            'orderBy'        => 'in:first_name,last_name,created_at',
            'orderDirection' => 'in:asc,desc',
        ]);

        $clients = $request->user()->agency->clients();

        if ($search = $request->input('search')) {
            $clients->where(function ($query) use ($search) {
                firstNameLastNameLike($search)($query);
                $query->orWhere('phone', 'LIKE', '%' . str_replace(' ', '', $search) . '%');
            });
        }

        $clients->orderBy($request->input('orderBy', 'first_name'), $request->input('orderDirection', 'asc'));

        return ResourceCollection::jsonResponse(
            $clients->paginate($request->integer('perPage', 20), [ '*' ], 'page', $request->integer('page', 1))
        );
    }

    public function show(Request $request, $clientId)
    {
        $client = $request->user()->agency->clients()
            ->with([ 'contracts' => fn ($query) => $query->with('car')->orderByDesc('starts_at'), 'documents' ])
            ->findOrFail($clientId);
        $client->stats = ClientStats::of($client); // the page's numbers and badge, also shown when booking
        $client->eligibility = $client->eligibilityIssues($request->user()->agency);

        return $this->clientResponse($client);
    }

    public function store(ClientRequest $request)
    {
        $client = $request->user()->agency->clients()->create($request->validated());

        return $this->clientResponse($client)->response()->setStatusCode(201);
    }

    public function update(ClientRequest $request, $clientId)
    {
        $client = $request->user()->agency->clients()->findOrFail($clientId);
        $client->update($request->validated());

        return $this->clientResponse($client);
    }

    /**
     * With the flagged clients this person matches, so staff are warned wherever they pick them.
     */
    private function clientResponse(Client $client): ClientResource
    {
        return new ClientResource($client->setRelation('warnings', $client->flaggedMatches()));
    }
}
