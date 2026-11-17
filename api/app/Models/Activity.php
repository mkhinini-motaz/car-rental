<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Model;

/**
 * One line of a contract's history, or of a staff account's (`staff_id`: role, branch,
 * disabled...): who did what, with the values that changed. Never edited.
 */
class Activity extends Model
{
    use DoesntConvertDates;

    protected $dateFormat = 'U';

    protected $fillable = [ 'action', 'changes', 'user_id', 'staff_id' ];

    protected $casts = [ 'changes' => 'array' ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed(); // disabled staff still show
    }

    public static function record(Contract $contract, string $action, ?array $changes = null): void
    {
        $contract->activities()->create([ 'action' => $action, 'changes' => $changes, 'user_id' => auth()->id() ]);
    }

    public static function recordStaff(User $staff, string $action, ?array $changes = null): void
    {
        self::create([ 'action' => $action, 'changes' => $changes ?: null, 'staff_id' => $staff->id, 'user_id' => auth()->id() ]);
    }
}
