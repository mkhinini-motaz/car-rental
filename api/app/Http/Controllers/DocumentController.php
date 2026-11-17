<?php

namespace App\Http\Controllers;

use App\Http\Resources\DocumentResource;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use function App\Support\Helpers\uploadFile;

/**
 * Photos of a car's or a client's papers. Any of the agency's users adds or deletes them; a
 * client's are deleted on request.
 */
class DocumentController extends Controller
{
    public function storeForCar(Request $request, $carId)
    {
        $car = $request->user()->agency->cars()->findOrFail($carId);

        return $this->store($request, Document::CAR_TYPES, "cars/{$car->id}/documents", [ 'car_id' => $car->id ]);
    }

    public function storeForClient(Request $request, $clientId)
    {
        $client = $request->user()->agency->clients()->findOrFail($clientId);

        return $this->store($request, Document::CLIENT_TYPES, "clients/{$client->id}", [ 'client_id' => $client->id ]);
    }

    public function destroy(Request $request, $documentId)
    {
        $request->user()->agency->documents()->findOrFail($documentId)->delete();

        return response()->noContent();
    }

    private function store(Request $request, array $types, string $folder, array $owner)
    {
        $data = $request->validate([
            'type' => [ 'required', Rule::in($types) ],
            'photo' => 'required|image|max:8192',
        ]);
        $document = Document::create([
            ...$owner,
            'type' => $data['type'],
            'path' => uploadFile($request->file('photo'), $folder),
            'agency_id' => $request->user()->agency_id,
        ]);

        return (new DocumentResource($document))->response()->setStatusCode(201);
    }
}
