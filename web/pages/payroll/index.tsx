import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Card, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAdd';
import { employees } from '../../src/api/money';
import { employeeName } from '../../src/classes/Employee';
import { COLORS } from '../../src/constants';
import { useT } from '../../src/store/Store';
import { Badge, Empty, Loading, Page, useMoney } from '../../src/components/common';
import EmployeeDialog from '../../src/components/EmployeeDialog';

// Payroll (owner): who works at the agency, their salary, and what is still due this month.
export default function PayrollPage() {
  const t = useT();
  const money = useMoney();
  const [isAdding, setIsAdding] = useState(false);
  const { isLoading, data } = useQuery({ queryKey: ['employee.index'], queryFn: employees });

  return (
    <Page title='payroll:label' actions={<Button variant='contained' startIcon={<PersonAdd />} onClick={() => setIsAdding(true)}>{t('payroll:add')}</Button>}>
      <Typography color='text.secondary' sx={{ mb: 2 }}>{t('payroll:hint')}</Typography>
      {isLoading ? <Loading /> : ! data?.length ? <Empty text='payroll:none' /> :
        <Card>
          <List disablePadding>
            {data.map(employee =>
              <ListItemButton key={employee.id} divider component={Link} href={'/payroll/' + employee.id} sx={{ opacity: employee.active ? 1 : 0.6 }}>
                <ListItemText primary={employeeName(employee)} secondary={[ employee.role_label, money(employee.monthly_salary) ].filter(Boolean).join(' · ')} />
                {! employee.active ? <Badge label='payroll:inactive' /> : (employee.due_this_month ?? 0) > 0 ?
                  <Box sx={{ textAlign: 'end' }}>
                    <Typography variant='caption' color='text.secondary'>{t('payroll:due')}</Typography>
                    <Typography sx={{ fontWeight: 700, color: COLORS.warn }}>{money(employee.due_this_month!)}</Typography>
                  </Box> :
                  <Badge label='payroll:paid' tone='ok' />}
              </ListItemButton>
            )}
          </List>
        </Card>
      }
      {isAdding && <EmployeeDialog employee={null} onClose={() => setIsAdding(false)} />}
    </Page>
  );
}
