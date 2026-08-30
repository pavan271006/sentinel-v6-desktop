import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VirtualizedTable, ColumnDef } from '../../src/design-system/VirtualizedTable';

interface TestItem {
  id: string;
  name: string;
  count: number;
}

describe('VirtualizedTable Component', () => {
  const sampleData: TestItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Resource #${i + 1}`,
    count: i * 10,
  }));

  const columns: ColumnDef<TestItem>[] = [
    { id: 'id', header: 'ID', width: 80, sortable: true, accessor: (row) => row.id },
    { id: 'name', header: 'Resource Name', width: 150, sortable: true, accessor: (row) => row.name },
    { id: 'count', header: 'Hit Count', width: 100, sortable: true, accessor: (row) => row.count },
  ];

  it('renders headers and items in viewport', () => {
    render(
      <VirtualizedTable
        data={sampleData}
        columns={columns}
        getRowId={(row) => row.id}
      />
    );

    expect(screen.getByText('Resource Name')).toBeInTheDocument();
    expect(screen.getByText('Resource #1')).toBeInTheDocument();
  });

  it('triggers onRowClick when a row is clicked', () => {
    const handleRowClick = vi.fn();
    render(
      <VirtualizedTable
        data={sampleData}
        columns={columns}
        getRowId={(row) => row.id}
        onRowClick={handleRowClick}
      />
    );

    const firstRow = screen.getByText('Resource #1');
    fireEvent.click(firstRow);
    expect(handleRowClick).toHaveBeenCalledWith(sampleData[0], 0);
  });

  it('renders empty message when data array is empty', () => {
    render(
      <VirtualizedTable
        data={[]}
        columns={columns}
        getRowId={(row) => (row as any).id}
        emptyMessage="Zero transactions captured"
      />
    );

    expect(screen.getByText('Zero transactions captured')).toBeInTheDocument();
  });

  it('sorts and groups rows by column when sortable header is clicked', () => {
    const unsortedTraffic = [
      { id: '1', method: 'POST', status: 200 },
      { id: '2', method: 'GET', status: 200 },
      { id: '3', method: 'PUT', status: 200 },
      { id: '4', method: 'GET', status: 200 },
      { id: '5', method: 'POST', status: 200 },
      { id: '6', method: 'DELETE', status: 200 },
    ];

    const trafficColumns: ColumnDef<any>[] = [
      {
        id: 'method',
        header: 'Method',
        sortable: true,
        sortValue: (row) => row.method,
        accessor: (row) => <span>{row.method}</span>,
      },
      { id: 'id', header: 'ID', sortable: true, accessor: (row) => row.id },
    ];

    render(
      <VirtualizedTable
        data={unsortedTraffic}
        columns={trafficColumns}
        getRowId={(row) => row.id}
      />
    );

    const methodHeader = screen.getByText('Method');

    // Click 1: Ascending sort (DELETE, GET, GET, POST, POST, PUT)
    fireEvent.click(methodHeader);
    const cellsAsc = screen.getAllByText(/DELETE|GET|POST|PUT/);
    expect(cellsAsc[0]).toHaveTextContent('DELETE');

    // Click 2: Descending sort (PUT, POST, POST, GET, GET, DELETE)
    fireEvent.click(methodHeader);
    const cellsDesc = screen.getAllByText(/DELETE|GET|POST|PUT/);
    expect(cellsDesc[0]).toHaveTextContent('PUT');
  });
});

