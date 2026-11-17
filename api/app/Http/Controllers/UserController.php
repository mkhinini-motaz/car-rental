<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Http\Resources\UserResource;
use App\Models\Activity;
use App\Models\Branch;
use App\Models\User;
use App\Support\Sms;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The owner's staff accounts. A disabled account is soft-deleted: it can't log in and its
 * token stops working, but its name stays on what it did. Added without a password, a staff
 * member is invited: they get a code (by SMS, and shown to the owner to pass on) and choose
 * their own password with it, like a forgotten one. Every change is in the account's history.
 */
class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = $request->user()->agency->users()->withTrashed()->orderBy('first_name')->get();

        return UserResource::collection($users);
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules($request));
        $user = $request->user()->agency->users()->create((int) $data['role'] === User::ROLE_OWNER ? [ ...$data, 'branch_id' => null ] : $data);
        Activity::recordStaff($user, 'staff_added', array_filter([ 'role' => $user->role, 'branch' => $this->branchName($user->branch_id) ]));
        // Everyone who works at the agency is on the payroll list; the owner sets the salary.
        $request->user()->agency->employees()->create([ 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'phone' => $user->phone, 'user_id' => $user->id ]);
        $invite = $user->password ? [] : [ 'invite_code' => $this->sendInvite($request, $user) ];

        return (new UserResource($user->refresh()))->additional($invite)->response()->setStatusCode(201);
    }

    /**
     * A new code for someone who hasn't set their password yet or forgot it. Their current
     * password keeps working until they use the code.
     */
    public function invite(Request $request, $userId)
    {
        $user = $request->user()->agency->users()->findOrFail($userId);
        $code = $this->sendInvite($request, $user);
        Activity::recordStaff($user, 'invited'); // never the code itself

        return response()->json([ 'invite_code' => $code ]);
    }

    private function sendInvite(Request $request, User $user): string
    {
        $code = $user->issuePasswordCode(User::INVITE_TTL);
        Sms::sendCode($user->phone, $code, $request->input('lang'), 'invite', $request->user()->agency->name);

        return $code;
    }

    public function update(Request $request, $userId)
    {
        $user = $request->user()->agency->users()->withTrashed()->findOrFail($userId);
        $data = $request->validate([ ...$this->rules($request, $user), 'disabled' => 'sometimes|boolean' ]);
        // An owner can't lock themselves out.
        $isSelf = $user->is($request->user());
        if ($isSelf && ($request->boolean('disabled') || (isset($data['role']) && $data['role'] !== User::ROLE_OWNER))) {
            throw ValidationException::withMessages([ 'role' => 'user:self' ]);
        }

        $user->fill(collect($data)->except('disabled')->filter(fn ($value, $key) => $key !== 'password' || $value)->all());
        if ((int) $user->role === User::ROLE_OWNER) {
            $user->branch_id = null; // owners see every branch
        }
        $changes = collect($user->getDirty())->except([ 'password', 'updated_at' ])
            ->mapWithKeys(fn ($value, $field) => $field === 'branch_id' ?
                [ 'branch' => [ $this->branchName($user->getOriginal('branch_id')), $this->branchName($value) ] ] :
                [ $field => [ $user->getOriginal($field), $value ] ])
            ->all();
        $passwordSet = $user->isDirty('password');
        $user->save();
        if ($changes) {
            Activity::recordStaff($user, 'updated', $changes);
        }
        if ($passwordSet) {
            Activity::recordStaff($user, 'password_set');
        }
        if ($request->has('disabled') && $request->boolean('disabled') !== $user->trashed()) {
            $request->boolean('disabled') ? $user->delete() : $user->restore();
            Activity::recordStaff($user, $request->boolean('disabled') ? 'disabled' : 'enabled');
        }

        return new UserResource($user);
    }

    /**
     * The account's history, newest first: who added it, changed its role or branch, disabled it...
     */
    public function activity(Request $request, $userId)
    {
        $user = $request->user()->agency->users()->withTrashed()->findOrFail($userId);

        return ActivityResource::collection($user->staffActivities()->with('user')->latest('id')->get());
    }

    private function branchName(?int $branchId): ?string
    {
        return $branchId ? Branch::withTrashed()->find($branchId)?->name : null;
    }

    private function rules(Request $request, ?User $user = null): array
    {
        $presence = $user ? 'sometimes' : 'required';

        return [
            'first_name' => "$presence|string|max:255",
            'last_name'  => "$presence|string|max:255",
            'phone'      => [ $presence, 'string', 'regex:/^\+216[234579]\d{7}$/', Rule::unique('users')->ignore($user?->id) ],
            'password'   => 'nullable|string|min:8|max:100', // none on a new account: an invitation
            'role'       => [ $presence, 'integer', Rule::in([ User::ROLE_OWNER, User::ROLE_MANAGER ]) ],
            'branch_id'  => [ 'nullable', 'integer', Rule::exists('branches', 'id')->where('agency_id', $request->user()->agency_id)->whereNull('deleted_at') ],
        ];
    }
}
