import { expect, test } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { click, invalid, renderPage, screen, sent, serve, signIn, t, unhandled } from './harness';
import { common, owner } from './fixtures';
import { ImportGuide, ImportReport } from '../../src/api/import';
import ImportPage from '../../pages/settings/import';

const column = (name: string, label: string, fields: object = {}) => ({ name, type: 'text' as const, required: false, label, example: null, options: null, ...fields });
const guide: ImportGuide = {
  cars: { columns: [
    column('licence_plate', 'car:licence_plate', { type: 'plate', required: true, example: '245 TU 1234' }),
    column('fuel', 'car:fuel_type', { type: 'choice', required: true, options: [ { value: 1, label: 'car:fuel_type:1', words: [ 'essence' ] }, { value: 2, label: 'car:fuel_type:2', words: [ 'diesel', 'gasoil' ] } ] }),
    column('model_year', 'car:model_year', { type: 'year', required: true }),
  ], template_url: 'http://api.test/api/import/template/cars?signature=x' },
  clients: { columns: [ column('phone', 'form:phone:label', { type: 'phone', required: true }) ], template_url: 'http://api.test/api/import/template/clients?signature=x' },
  rentals: { columns: [ column('paid', 'import:column:paid', { type: 'money' }) ], template_url: 'http://api.test/api/import/template/rentals?signature=x' },
};
const checked: ImportReport = {
  cars: {
    header: { fixes: [ { from: 'Carburant', to: 'fuel', sure: true }, { from: 'Anée', to: 'model_year', sure: false } ], ignored: [ 'Divers' ], missing: [] },
    counts: { new: 2, updated: 0, unchanged: 0, rejected: 1 },
    rows: [
      { line: 2, cells: { licence_plate: '777tu77', fuel: 'Gazoil', model_year: '2021' }, result: 'new',
        fixes: [ { column: 'licence_plate', from: '777tu77', to: '777 TU 77', sure: true }, { column: 'fuel', from: 'Gazoil', to: 'diesel', sure: false } ], errors: [] },
      { line: 3, cells: { licence_plate: '198 TU 6040', fuel: 'essence', model_year: 'deux mille' }, result: 'rejected',
        fixes: [], errors: [ { column: 'model_year', code: 'import:error:number', params: {} } ] },
      { line: 4, cells: { licence_plate: '245 TU 1234', fuel: 'essence', model_year: '2022' }, result: 'new', fixes: [], errors: [] },
    ],
  },
};

test('importing: the guide and templates, a check with a guess to confirm and an error to fix, then the import', async () => {
  signIn(owner);
  serve({ ...common, 'GET import': guide, 'POST import': (request: { data: unknown }) => request.data instanceof FormData ? checked : (request.data as { apply: boolean }).apply ?
    { cars: { counts: { new: 3, updated: 0, unchanged: 0, rejected: 0 }, rows: [] } } :
    { cars: { counts: { new: 3, updated: 0, unchanged: 0, rejected: 0 }, rows: checked.cars!.rows.map(row => ({ ...row, fixes: [], errors: [], result: 'new' })) } } });
  renderPage(ImportPage, '/settings/import');

  // Each file's template and columns.
  expect((await screen.findAllByText(t('import:template')))[0].closest('a')!.getAttribute('href')).toBe(guide.cars.template_url);
  fireEvent.click(screen.getAllByText(t('import:columns'))[0]);
  expect(screen.getByText('diesel (' + t('car:fuel_type:2') + ')', { exact: false })).toBeTruthy();

  fireEvent.change(document.querySelectorAll('input[type=file]')[0], { target: { files: [ new File([ 'licence_plate;fuel' ], 'voitures.csv', { type: 'text/csv' }) ] } });
  await click(t('import:check'));
  // Column names read as aliases are counted, and listed on demand.
  expect(await screen.findByText(t('import:header:count', { count: 1 }))).toBeTruthy();
  fireEvent.click(screen.getAllByText(t('import:reformatted:show'))[0]);
  expect(screen.getByText(t('import:header:read', { from: 'Carburant', to: t('car:fuel_type') }))).toBeTruthy();
  expect((sent('POST import')[0].data as FormData).get('files[cars]')).toBeInstanceOf(File);
  expect(screen.getByText(t('import:header:ignored', { columns: 'Divers' }))).toBeTruthy();
  expect(screen.getByText(t('import:ready', { count: 1 }))).toBeTruthy();
  expect(screen.getByText(t('import:reformatted', { count: 1 }))).toBeTruthy();
  expect(screen.getByText(t('import:error:number', { column: t('car:model_year') }))).toBeTruthy();
  // A close column name is a guess too, with what to do when it's wrong.
  expect(screen.getByText(t('import:header:read', { from: 'Anée', to: t('car:model_year') }))).toBeTruthy();
  expect(screen.getByText(t('import:header:guess'))).toBeTruthy();
  // The guesses hold the import back until they're confirmed.
  expect(screen.getByText(t('import:pending', { count: 2 }))).toBeTruthy();
  expect(screen.getByText(t('import:save', { count: 2 })).closest('button')!.disabled).toBe(true);
  await click(t('import:confirm')); // the column
  await click(t('import:confirm')); // the cell

  // The error: the right value typed, then checked again.
  fireEvent.click(screen.getByText(t('import:change')));
  fireEvent.change(screen.getByLabelText(t('car:model_year')), { target: { value: '2020' } });
  await click(t('import:recheck'));
  await waitFor(() => expect(sent('POST import')).toHaveLength(2));
  expect(sent('POST import')[1].data).toEqual({ apply: false, rows: { cars: [
    { line: 2, cells: { licence_plate: '777 TU 77', fuel: 'diesel', model_year: '2021' } }, // the format fix and the confirmed guess written in
    { line: 3, cells: { licence_plate: '198 TU 6040', fuel: 'essence', model_year: '2020' } },
    { line: 4, cells: { licence_plate: '245 TU 1234', fuel: 'essence', model_year: '2022' } },
  ] } });

  // The column's confirmation holds through the check again.
  expect(screen.queryByText(t('import:pending', { count: 1 }))).toBeNull();
  await click(t('import:save', { count: 3 }));
  await waitFor(() => expect(sent('POST import')).toHaveLength(3));
  expect(sent('POST import')[2].data).toMatchObject({ apply: true });
  expect(await screen.findByText(t('import:done', { new: 3, updated: 0, unchanged: 0 }))).toBeTruthy();
  expect(unhandled).toEqual([]);
});

test('an Excel workbook is refused with what to do', async () => {
  signIn(owner);
  serve({ ...common, 'GET import': guide, 'POST import': invalid({ 'files.clients': [ 'import:error:xlsx' ] }) });
  renderPage(ImportPage, '/settings/import');

  await screen.findAllByText(t('import:file:choose'));
  fireEvent.change(document.querySelectorAll('input[type=file]')[1], { target: { files: [ new File([ 'PK' ], 'clients.xlsx') ] } });
  await click(t('import:check'));
  expect(await screen.findByText(t('import:kind:clients') + ' : ' + t('import:error:xlsx'))).toBeTruthy();
});
