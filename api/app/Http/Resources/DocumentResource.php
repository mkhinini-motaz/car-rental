<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

use function App\Support\Helpers\fileUrl;

class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            // A car's papers keep a permanent link, so the phone has them offline at a police
            // check. A client's are personal: their link lasts an hour.
            'url' => fileUrl($this->path, $this->client_id ? 60 : null),
            'created_at' => $this->created_at,
        ];
    }
}
