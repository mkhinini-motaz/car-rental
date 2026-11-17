<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Client>
 */
class ClientFactory extends Factory
{
    const MALE_FIRST_NAMES = [ 'Mohamed', 'Ahmed', 'Youssef', 'Sami', 'Karim', 'Walid', 'Bilel', 'Hamza', 'Anis', 'Mehdi' ];
    const FEMALE_FIRST_NAMES = [ 'Amira', 'Mariem', 'Sana', 'Ines', 'Rania', 'Nour', 'Hela', 'Salma', 'Emna', 'Olfa' ];
    const LAST_NAMES = [ 'Ben Ali', 'Trabelsi', 'Gharbi', 'Mejri', 'Hammami', 'Khelifi', 'Sassi', 'Jlassi', 'Ayari', 'Dridi', 'Mansouri', 'Ferchichi', 'Chaabane', 'Bouzid', 'Zouari' ];

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $faker = $this->faker;
        $gender = $faker->randomElement([ Client::GENDER_MALE, Client::GENDER_FEMALE ]);

        return [
            'first_name' => $faker->randomElement($gender === Client::GENDER_MALE ? self::MALE_FIRST_NAMES : self::FEMALE_FIRST_NAMES),
            'last_name' => $faker->randomElement(self::LAST_NAMES),
            'phone' => $faker->unique()->numerify('+216' . $faker->randomElement([ 2, 5, 9 ]) . '#######'),
            'gender' => $gender,
            'birth_date' => $faker->dateTimeBetween('-65 years', '-20 years')->format('d/m/Y'),
            'id_number' => $faker->numerify('########'),
            'driver_licence_number' => $faker->numerify('##/######'),
            'driver_licence_delivery_date' => $faker->dateTimeBetween('-20 years', '-1 year')->format('d/m/Y'),
            'agency_id' => Agency::factory(),
        ];
    }
}
