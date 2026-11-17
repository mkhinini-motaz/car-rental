<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

use function App\Support\Helpers\fileUrl;

class ContractPhotoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stage' => $this->stage,
            'angle' => $this->angle,
            'url' => fileUrl($this->path),
            'created_at' => $this->created_at,
        ];
    }
}
