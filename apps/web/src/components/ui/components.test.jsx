import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { DataTable } from './DataTable.jsx';
import { ConfirmDialog, Modal } from './Dialog.jsx';
import { Dropdown } from './Dropdown.jsx';
import { Pagination, pageItems } from './Pagination.jsx';
import { Tabs } from './Tabs.jsx';
import { DatePicker, TextField } from './TextField.jsx';
import { ToastProvider, useToast } from './Toast.jsx';
import { Tooltip } from './Tooltip.jsx';

describe('Modal / ConfirmDialog', () => {
  function Harness({ onConfirm = vi.fn() }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={onConfirm}
          title="Supprimer ?"
          message="Action définitive."
          confirmLabel="Supprimer"
        />
      </>
    );
  }

  it('is labelled by its title and starts on the safe Cancel button', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog', { name: 'Supprimer ?' });
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('button', { name: 'Annuler' })).toHaveFocus();
  });

  it('closes with Escape (cancel event) and with the close button', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs the confirmation', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes when the dimmed backdrop is clicked, not when the panel is', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titre">
        <p>Contenu</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText('Contenu'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Dropdown (menu button)', () => {
  const setup = () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <Dropdown
        label="Actions"
        triggerContent="⋯"
        items={[
          { id: 'edit', label: 'Modifier', onSelect: onEdit },
          { id: 'archive', label: 'Archiver', onSelect: vi.fn(), disabled: true },
          { id: 'delete', label: 'Supprimer', onSelect: onDelete, tone: 'danger' },
        ]}
      />,
    );
    return { onEdit, onDelete, trigger: screen.getByRole('button', { name: 'Actions' }) };
  };

  it('opens on ArrowDown, skips disabled items, and closes on Escape back to the button', async () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('menuitem', { name: 'Modifier' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Modifier' })).toHaveFocus(); // wraps

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('selects with Enter and by typing the first letter', async () => {
    const { trigger, onDelete } = setup();
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    // Focus must already be in the menu (no frame delay), or fast typing would hit the button.
    expect(screen.getByRole('menuitem', { name: 'Modifier' })).toHaveFocus();
    await userEvent.keyboard('s{Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on a click outside', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('Tabs', () => {
  function Harness() {
    const [value, setValue] = useState('a');
    return (
      <Tabs
        label="Vues"
        value={value}
        onChange={setValue}
        tabs={[
          { id: 'a', label: 'Mois', content: 'Vue mois' },
          { id: 'b', label: 'Semaine', content: 'Vue semaine' },
          { id: 'c', label: 'Jour', content: 'Vue jour' },
        ]}
      />
    );
  }

  it('has one tab stop and follows arrow keys', async () => {
    render(<Harness />);
    const [month, week, day] = screen.getAllByRole('tab');
    expect(month).toHaveAttribute('tabindex', '0');
    expect(week).toHaveAttribute('tabindex', '-1');

    month.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(week).toHaveFocus();
    expect(week).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Vue semaine');

    await userEvent.keyboard('{End}');
    expect(day).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(month).toHaveFocus(); // wraps
  });

  it('reverses arrow keys in a right-to-left layout', async () => {
    render(
      <div dir="rtl">
        <Harness />
      </div>,
    );
    const [month, week] = screen.getAllByRole('tab');
    month.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(week).toHaveFocus();
  });
});

describe('Tooltip', () => {
  it('describes its trigger, shows on focus and hides on Escape', async () => {
    render(
      <Tooltip content="Exporter en CSV">
        <button type="button">Exporter</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Exporter' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(trigger).toHaveAccessibleDescription('Exporter en CSV');

    await userEvent.tab();
    expect(tooltip).toHaveClass('opacity-100');
    await userEvent.keyboard('{Escape}');
    expect(tooltip).toHaveClass('opacity-0');
  });
});

describe('Pagination', () => {
  it('computes compact page lists with gaps', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(5, 10)).toEqual([1, 'gap-4', 4, 5, 6, 'gap-10', 10]);
    expect(pageItems(10, 10)).toEqual([1, 'gap-9', 9, 10]);
  });

  it('marks the current page and disables impossible moves', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={4} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'label', header: 'Libellé', sortable: true, primary: true },
    { key: 'amount', header: 'Montant', align: 'end', sortable: true },
  ];
  const rows = [
    { id: 1, label: 'Électricité', amount: '450,00 MAD' },
    { id: 2, label: 'Internet', amount: '299,00 MAD' },
  ];

  it('exposes sort state to assistive technology and requests the next sort', async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        caption="Factures"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        sort={{ key: 'amount', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    const table = screen.getByRole('table', { name: 'Factures' });
    const [labelHeader, amountHeader] = within(table).getAllByRole('columnheader');
    expect(amountHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(labelHeader).toHaveAttribute('aria-sort', 'none');

    await userEvent.click(within(amountHeader).getByRole('button'));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'amount', direction: 'desc' });
  });

  it('also renders one card per row for phones', () => {
    render(<DataTable caption="Factures" columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const cards = screen.getByRole('list', { name: 'Factures' });
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
    expect(within(cards).getByText('299,00 MAD')).toBeInTheDocument();
  });

  it('shows the empty state instead of an empty table', () => {
    render(
      <DataTable
        caption="Factures"
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        empty={<p>Aucune facture</p>}
      />,
    );
    expect(screen.getByText('Aucune facture')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return (
      <button type="button" onClick={() => toast.success('Invitation envoyée.')}>
        Go
      </button>
    );
  }

  it('announces messages in a persistent live region and dismisses them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument(); // present before any toast

    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(within(region).getByText('Invitation envoyée.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    expect(within(region).queryByText('Invitation envoyée.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    await act(() => vi.advanceTimersByTimeAsync(5100));
    expect(within(region).queryByText('Invitation envoyée.')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('Fields', () => {
  it('connects label, hint and error to the input', () => {
    render(<TextField label="Nom" hint="Visible par la famille" error="Trop court." />);
    const input = screen.getByLabelText('Nom');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Trop court.');
  });

  it('renders a native date input for the date picker', () => {
    render(<DatePicker label="Échéance" defaultValue="2026-11-30" />);
    const input = screen.getByLabelText('Échéance');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-11-30');
  });
});
