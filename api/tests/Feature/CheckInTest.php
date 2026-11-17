<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CheckInTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_client_fills_in_their_papers_before_the_pickup_through_a_signed_link(): void
    {
        Storage::fake();
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $client = Client::factory()->create([ 'agency_id' => $user->agency_id, 'id_number' => null, 'driver_licence_number' => null ]);
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id, 'starts_at' => time() + 86400, 'ends_at' => time() + 3 * 86400 ]);
        $known = Client::factory()->create([ 'agency_id' => $user->agency_id, 'phone' => '+21622333444', 'first_name' => 'Karim' ]);

        $url = $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/checkin-link")->assertOk()->json('data.url');
        $this->assertStringStartsWith('http://localhost:3010/checkin?link=', $url);
        $api = urldecode(substr($url, strlen('http://localhost:3010/checkin?link=')));
        $this->getJson($api)->assertOk()->assertJsonPath('data.client.first_name', $client->first_name)->assertJsonPath('data.second_driver', null);
        $this->getJson("/api/checkin/{$contract->id}")->assertForbidden(); // unsigned

        $this->post($api, [
            'client' => [ 'first_name' => 'Amine', 'last_name' => 'Ben Salah', 'id_number' => '09876543', 'driver_licence_number' => '12/345678', 'driver_licence_delivery_date' => '01/02/2015' ],
            'second_driver' => [ 'first_name' => 'Karim', 'last_name' => 'Trabelsi', 'phone' => '+21622333444', 'driver_licence_number' => '99/111222', 'driver_licence_delivery_date' => '03/04/2012' ],
            'id_photo' => UploadedFile::fake()->image('cin.jpg'),
        ], [ 'Accept' => 'application/json' ])->assertNoContent();

        $client->refresh();
        $this->assertSame([ 'Amine', '09876543', '12/345678' ], [ $client->first_name, $client->id_number, $client->driver_licence_number ]);
        $this->assertSame($known->id, $contract->fresh()->second_driver_id); // the agency's own record, completed
        $this->assertSame('99/111222', $known->fresh()->driver_licence_number);
        $this->assertSame([ Document::TYPE_ID_CARD ], $client->documents()->pluck('type')->all());
        $this->assertSame('checked_in', $contract->activities()->latest('id')->value('action'));

        // Once the car is out, the link is closed; another agency can't make one.
        $contract->forceFill([ 'status' => Contract::STATUS_OUT ])->save();
        $this->getJson($api)->assertStatus(410);
        $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/checkin-link")->assertUnprocessable();
        $this->actingAsUser(User::factory()->create())->postJson("/api/contract/{$contract->id}/checkin-link")->assertNotFound();
    }

    public function test_the_client_reads_the_contract_and_signs_it_through_the_check_in_link(): void
    {
        $user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $user->agency_id ]);
        $client = Client::factory()->create([ 'agency_id' => $user->agency_id ]);
        $contract = Contract::factory()->create([ 'car_id' => $car->id, 'client_id' => $client->id, 'starts_at' => time() + 86400, 'ends_at' => time() + 3 * 86400 ]);
        $url = $this->actingAsUser($user)->postJson("/api/contract/{$contract->id}/checkin-link")->assertOk()->json('data.url');
        $api = urldecode(substr($url, strlen('http://localhost:3010/checkin?link=')));

        $data = $this->getJson($api)->assertOk()->assertJsonPath('data.signed_at', null)->json('data');
        $this->get($data['contract_urls']['fr'])->assertOk()->assertHeader('Content-Type', 'application/pdf'); // the terms, before signing
        $this->get($data['contract_urls']['ar'])->assertOk();

        $details = [ 'client' => [ 'first_name' => $client->first_name, 'last_name' => $client->last_name ] ];
        $this->postJson($api, [ ...$details, 'contract_signature' => '<script>' ])->assertJsonValidationErrors('contract_signature');
        $this->postJson($api, [ ...$details, 'contract_signature' => 'M10 20 L30 40' ])->assertNoContent();

        $contract->refresh();
        $this->assertSame('M10 20 L30 40', $contract->signature);
        $this->assertEqualsWithDelta(time(), $contract->signed_at, 5);
        $this->assertSame([ 'checked_in', 'signed_remotely' ], $contract->activities()->orderBy('id')->pluck('action')->all());
        $this->getJson($api)->assertJsonPath('data.signature', 'M10 20 L30 40');

        // Sending the details again without a signature keeps the one given.
        $this->postJson($api, $details)->assertNoContent();
        $this->assertSame('M10 20 L30 40', $contract->fresh()->signature);
    }
}
