import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Divider, Grid, IconButton, Stack, Typography } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { destroySalaryPayment, employee as show, MONEY_QUERIES } from '../../src/api/money';
import { employeeName, TYPE_ADVANCE, TYPE_SALARY } from '../../src/classes/Employee';
import { useT } from '../../src/store/Store';
import { formatDate, formatLocalPhoneNumber } from '../../src/support/utils';
import { useFeedback } from '../../src/components/Feedback';
import { Empty, Info, Loading, Page, Section, useMoney } from '../../src/components/common';
import EmployeeDialog from '../../src/components/EmployeeDialog';
import { SalaryDialog } from '../../src/components/moneyDialogs';

// An employee: this month (paid, due), a payment one click away, and every payment with the year's total.
export default function EmployeePage() {
  const t = useT();
  const money = useMoney();
  const employeeId = Number(useRouter().query.id);
  const queryClient = useQueryClient();
  const { confirm, requestError } = useFeedback();
  const [paying, setPaying] = useState<{ type: number, amount?: number }|null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { isLoading, data } = useQuery({ queryKey: ['employee.show', { id: employeeId }], queryFn: show });
  const remove = useMutation({
    mutationFn: (paymentId: number) => destroySalaryPayment(employeeId, paymentId),
    onSuccess: () => MONEY_QUERIES.forEach(key => queryClient.invalidateQueries({ queryKey: [key] })),
    onError: requestError,
  });

  if (isLoading) {
    return <Loading />;
  }
  if (! data) {
    return <Page title='payroll:employee'><Empty /></Page>;
  }
  const due = data.due_this_month ?? 0;

  return (
    <Page
      titleText={employeeName(data)}
      actions={<>
        <Button variant='contained' disabled={! data.active} onClick={() => setPaying({ type: TYPE_SALARY, amount: due || undefined })}>{t('payroll:pay_salary')}</Button>
        <Button variant='outlined' disabled={! data.active} onClick={() => setPaying({ type: TYPE_ADVANCE })}>{t('payroll:pay_advance')}</Button>
        <Button variant='outlined' startIcon={<Edit />} onClick={() => setIsEditing(true)}>{t('common:edit')}</Button>
      </>}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Section>
            {data.role_label && <Typography color='text.secondary'>{data.role_label}</Typography>}
            {data.phone && <Info label='form:phone:label' value={<span dir='ltr'>{formatLocalPhoneNumber(data.phone)}</span>} />}
            <Info label='payroll:salary' value={money(data.monthly_salary)} />
            {data.hired_at && <Info label='payroll:hired_at' value={formatDate(data.hired_at)} />}
            <Divider />
            <Info label='payroll:paid_this_month' value={money(data.paid_this_month ?? 0)} />
            <Info label='payroll:due' value={money(due)} tone={due > 0 ? 'warn' : 'ok'} bold />
            <Info label='payroll:year_total' value={money(data.year_total ?? 0)} />
          </Section>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Section title='payroll:payments'>
            {data.payments?.length ? data.payments.map(payment =>
              <Stack key={payment.id} direction='row' sx={{ alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant='body2' sx={{ fontWeight: 600 }}>{t('payroll:type:' + payment.type, { month: payment.month })}</Typography>
                  <Typography variant='caption' color='text.secondary'>{[ formatDate(payment.paid_at), t('payment:method:' + payment.method), payment.note ].filter(Boolean).join(' · ')}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{money(payment.amount)}</Typography>
                <IconButton size='small' color='error' aria-label={t('common:delete')} onClick={async () => await confirm('payroll:payment:delete') && remove.mutate(payment.id)}><DeleteOutline fontSize='small' /></IconButton>
              </Stack>
            ) : <Empty />}
          </Section>
        </Grid>
      </Grid>
      {paying && <SalaryDialog employee={data} type={paying.type} amount={paying.amount} onClose={() => setPaying(null)} />}
      {isEditing && <EmployeeDialog employee={data} onClose={() => setIsEditing(false)} />}
    </Page>
  );
}
