<?php

namespace App\Models;

use App\Support\DoesntConvertDates;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A rent payment on a contract. The security deposit is not a payment: it lives on the contract.
 */
class Payment extends Model
{
    use HasFactory, SoftDeletes, DoesntConvertDates;

    protected $dateFormat = 'U';

    // Also used for the deposit's method and an expense's.
    const METHOD_CASH = 1;
    const METHOD_CARD = 2;
    const METHOD_TRANSFER = 3;
    const METHOD_CHEQUE = 4;
    const METHODS = [ self::METHOD_CASH, self::METHOD_CARD, self::METHOD_TRANSFER, self::METHOD_CHEQUE ];
    // Taken out of the deposit the agency holds (return charges): payments only.
    const METHOD_DEPOSIT = 5;

    protected $fillable = [ 'amount', 'method', 'paid_at', 'user_id' ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
