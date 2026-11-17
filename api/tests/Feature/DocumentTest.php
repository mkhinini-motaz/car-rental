<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_car_papers_and_client_ids_are_stored_privately_and_deleted_with_their_file(): void
    {
        Storage::fake();
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $client = Client::factory()->create([ 'agency_id' => $user->agency_id ]);

        $this->actingAsUser($user)->postJson("/api/car/{$car->id}/document", [ 'type' => Document::TYPE_INSURANCE, 'photo' => UploadedFile::fake()->image('insurance.jpg') ])
            ->assertCreated()->assertJsonPath('data.type', Document::TYPE_INSURANCE); // an int, not the form's string
        $carDocument = $this->actingAsUser($user)->getJson("/api/car/{$car->id}")->assertOk()->json('data.documents.0');
        $this->assertStringNotContainsString('expires=', $carDocument['url']); // cached for police checks
        $this->get($carDocument['url'])->assertOk();

        // A client type on a car, and the reverse, are refused.
        $this->actingAsUser($user)->postJson("/api/car/{$car->id}/document", [ 'type' => Document::TYPE_ID_CARD, 'photo' => UploadedFile::fake()->image('x.jpg') ])->assertUnprocessable();
        $this->actingAsUser($user)->postJson("/api/client/{$client->id}/document", [ 'type' => Document::TYPE_INSURANCE, 'photo' => UploadedFile::fake()->image('x.jpg') ])->assertUnprocessable();

        $this->actingAsUser($user)->postJson("/api/client/{$client->id}/document", [ 'type' => Document::TYPE_DRIVER_LICENCE, 'photo' => UploadedFile::fake()->image('licence.jpg') ])->assertCreated();
        $clientDocument = $this->actingAsUser($user)->getJson("/api/client/{$client->id}")->assertOk()->json('data.documents.0');
        $this->assertStringContainsString('expires=', $clientDocument['url']); // personal: the link lasts an hour
        $this->get($clientDocument['url'])->assertOk();
        $this->travel(2)->hours();
        $this->get($clientDocument['url'])->assertForbidden();

        // Another agency can neither add to nor delete them.
        $stranger = User::factory()->create();
        $this->actingAsUser($stranger)->postJson("/api/client/{$client->id}/document", [ 'type' => Document::TYPE_ID_CARD, 'photo' => UploadedFile::fake()->image('x.jpg') ])->assertNotFound();
        $this->actingAsUser($stranger)->deleteJson("/api/document/{$clientDocument['id']}")->assertNotFound();

        $path = Document::find($clientDocument['id'])->path;
        Storage::assertExists($path);
        $this->actingAsUser($user)->deleteJson("/api/document/{$clientDocument['id']}")->assertNoContent();
        Storage::assertMissing($path);
        $this->assertSame(1, Document::count());
    }
}
