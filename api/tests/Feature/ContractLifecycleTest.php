<?php

namespace Tests\Feature;

use App\Models\Car;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPhoto;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ContractLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Contract $contract;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake();
        $this->user = User::factory()->create();
        $car = Car::factory()->create([ 'agency_id' => $this->user->agency_id, 'mileage' => 20000 ]);
        // Two days at 90 TND: 180 TND due.
        $this->contract = Contract::factory()->create([ 'car_id' => $car->id, 'daily_price' => 90000, 'starts_at' => 0, 'ends_at' => 2 * 86400 ]);
    }

    private function act(string $action, array $data = [])
    {
        return $this->actingAsUser($this->user)->postJson("/api/contract/{$this->contract->id}/$action", $data);
    }

    public function test_pickup_return_pay_and_close(): void
    {
        $this->act('pickup', [
            'mileage' => 20150,
            'deposit' => 500000,
            'deposit_method' => Payment::METHOD_CHEQUE,
            'photos' => [
                [ 'angle' => ContractPhoto::ANGLE_FRONT, 'file' => UploadedFile::fake()->image('front.jpg') ],
                [ 'angle' => ContractPhoto::ANGLE_DASHBOARD, 'file' => UploadedFile::fake()->image('dash.jpg') ],
            ],
            'damages' => [ [ 'x' => 250, 'y' => 100, 'note' => 'Scratch on the front bumper' ] ],
        ])
            ->assertOk()
            ->assertJsonPath('data.status', Contract::STATUS_OUT)
            ->assertJsonPath('data.pickup_mileage', 20150)
            ->assertJsonPath('data.deposit', 500000)
            ->assertJsonPath('data.photos.1.angle', ContractPhoto::ANGLE_DASHBOARD)
            ->assertJsonPath('data.photos.0.stage', ContractPhoto::STAGE_PICKUP)
            ->assertJsonPath('data.damages.0.note', 'Scratch on the front bumper')
            ->assertJsonPath('data.total_price', 180000)
            ->assertJsonPath('data.paid', 0);
        Storage::assertExists(ContractPhoto::first()->path);
        $this->assertSame(20150, $this->contract->car->refresh()->mileage);

        $this->act('return', [ 'mileage' => 20100 ])->assertJsonValidationErrors('mileage'); // below the pickup reading
        $this->act('return', [ 'mileage' => 20480 ])
            ->assertOk()
            ->assertJsonPath('data.status', Contract::STATUS_RETURNED)
            ->assertJsonPath('data.return_mileage', 20480);

        // Rent not fully paid yet.
        $this->act('payment', [ 'amount' => 100000, 'method' => Payment::METHOD_CASH ])->assertCreated();
        $this->act('close', [ 'deposit_kept' => 0 ])->assertJsonPath('errors.payments', [ 'contract:unpaid' ]);

        $this->act('payment', [ 'amount' => 80000, 'method' => Payment::METHOD_CARD ])->assertCreated();
        $this->act('close', [ 'deposit_kept' => 40000 ])->assertJsonValidationErrors('deposit_kept_reason');
        $this->act('close', [ 'deposit_kept' => 600000, 'deposit_kept_reason' => 'Fuel' ])->assertJsonValidationErrors('deposit_kept'); // more than taken
        $this->act('close', [ 'deposit_kept' => 40000, 'deposit_kept_reason' => 'Fuel' ])
            ->assertOk()
            ->assertJsonPath('data.status', Contract::STATUS_CLOSED)
            ->assertJsonPath('data.paid', 180000)
            ->assertJsonPath('data.deposit_kept', 40000)
            ->assertJsonCount(2, 'data.payments');

        // A closed contract is final.
        $this->act('payment', [ 'amount' => 1000, 'method' => Payment::METHOD_CASH ])->assertJsonPath('errors.status', [ 'contract:status' ]);
        $this->actingAsUser($this->user)->putJson("/api/contract/{$this->contract->id}", [ 'note' => 'x' ])->assertJsonValidationErrors('status');
    }

    public function test_pickup_needs_the_clients_id_and_licence(): void
    {
        $this->contract->client->update([ 'id_number' => null ]);

        $this->act('pickup', [ 'mileage' => 20000 ])->assertJsonPath('errors.client', [ 'client:incomplete' ]);
        $this->assertSame(Contract::STATUS_RESERVED, $this->contract->refresh()->status);
    }

    public function test_actions_follow_the_status(): void
    {
        $this->act('return', [ 'mileage' => 20000 ])->assertJsonValidationErrors('status'); // not picked up yet
        $this->act('close', [ 'deposit_kept' => 0 ])->assertJsonValidationErrors('status');
        $this->act('pickup', [ 'mileage' => 20000, 'deposit' => 1000 ])->assertJsonValidationErrors('deposit_method');
        $this->act('pickup', [ 'mileage' => 20000, 'photos' => [ [ 'angle' => 9, 'file' => UploadedFile::fake()->image('x.jpg') ] ] ])
            ->assertJsonValidationErrors('photos.0.angle');

        $this->act('pickup', [ 'mileage' => 20000 ])->assertOk();
        $this->act('pickup', [ 'mileage' => 20000 ])->assertJsonValidationErrors('status');
        // Handed over: it can no longer be cancelled.
        $this->actingAsUser($this->user)->deleteJson("/api/contract/{$this->contract->id}")->assertJsonValidationErrors('status');
    }

    public function test_cancel_marks_the_reservation_cancelled(): void
    {
        $this->actingAsUser($this->user)->deleteJson("/api/contract/{$this->contract->id}")->assertNoContent();

        $this->assertSoftDeleted($this->contract);
        $this->assertSame(Contract::STATUS_CANCELLED, Contract::withTrashed()->find($this->contract->id)->status);
    }

    public function test_payments_can_be_removed_and_listed_by_status(): void
    {
        $paymentId = $this->act('payment', [ 'amount' => 50000, 'method' => Payment::METHOD_TRANSFER ])->json('data.id');
        $as = $this->actingAsUser($this->user);

        $as->getJson('/api/contract?status[]=' . Contract::STATUS_RESERVED)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.paid', 50000);
        $as->getJson('/api/contract?status[]=' . Contract::STATUS_OUT)->assertJsonCount(0, 'data');
        $as->getJson('/api/contract?status[]=9')->assertJsonValidationErrors('status.0');

        $as->deleteJson("/api/contract/{$this->contract->id}/payment/$paymentId")->assertNoContent();
        $as->getJson("/api/contract/{$this->contract->id}")->assertJsonPath('data.paid', 0);

        $foreign = Contract::factory()->create();
        $as->postJson("/api/contract/{$foreign->id}/payment", [ 'amount' => 1, 'method' => 1 ])->assertNotFound();
        $as->postJson("/api/contract/{$foreign->id}/pickup", [ 'mileage' => 1 ])->assertNotFound();
    }

    public function test_a_handover_sent_later_keeps_its_real_time(): void
    {
        // Saved on the phone in a car park an hour ago, before the booked end; sent now.
        // Lateness is charged by the hour from the end: sent now, it would be 30 minutes late.
        $this->user->agency->forceFill([ 'pricing' => [ 'late_per' => 'hour', 'late_grace_hours' => 0, 'late_hour_price' => 10000 ] ])->save();
        $this->contract->update([ 'starts_at' => time() - 3 * 86400, 'ends_at' => time() - 1800 ]);
        $this->contract->client->update([ 'id_number' => '01234567', 'driver_licence_number' => '12/345678', 'driver_licence_delivery_date' => '01/01/2015' ]);
        $this->act('pickup', [ 'mileage' => 20000, 'at' => time() - 3 * 86400 ])->assertOk();
        $this->act('return', [ 'mileage' => 20300, 'at' => time() - 10 * 86400 ])->assertJsonValidationErrors('at'); // more than a week back
        $this->act('return', [ 'mileage' => 20300, 'at' => time() - 3600 ])->assertOk()->assertJsonPath('data.charges', []);
        $this->assertEqualsWithDelta(time() - 3600, $this->contract->refresh()->returned_at, 5);
    }
}
