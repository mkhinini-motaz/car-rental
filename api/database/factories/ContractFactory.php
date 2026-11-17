<?php

namespace Database\Factories;

use App\Models\Car;
use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Contract>
 */
class ContractFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startsAt = now()->startOfDay()
            ->addDays($this->faker->numberBetween(-30, 30))
            ->setHour($this->faker->randomElement([8, 10, 14, 18]));

        // car_id must stay first: the closures below read it.
        return [
            'car_id' => Car::factory(),
            'client_id' => fn (array $attributes) => Client::factory()->create([
                'agency_id' => Car::find($attributes['car_id'])->agency_id,
            ])->id,
            'daily_price' => fn (array $attributes) => Car::find($attributes['car_id'])->daily_price,
            'starts_at' => $startsAt->getTimestamp(),
            'ends_at' => $startsAt->copy()->addDays($this->faker->numberBetween(1, 15))->getTimestamp(),
        ];
    }
}
