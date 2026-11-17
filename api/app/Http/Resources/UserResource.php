<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'phone' => $this->phone,
            'agency_id' => $this->agency_id,
            'role' => $this->role,
            'branch_id' => $this->branch_id, // a manager limited to one branch
            'disabled' => $this->trashed(),
            'invited' => $this->password === null, // hasn't chosen a password yet
            'access_token' => $this->access_token,
        ];
    }
}
