<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'changes' => $this->changes,
            'user' => $this->user ? [ 'id' => $this->user->id, 'first_name' => $this->user->first_name, 'last_name' => $this->user->last_name ] : null,
            'created_at' => $this->created_at,
        ];
    }
}
