/**
 * Component gallery — DEVELOPMENT ONLY (route registered only when import.meta.env.DEV).
 * It is not part of production builds: it exists to review every design-system component, test
 * it in a real browser (Playwright + axe) and screenshot it at desktop and phone widths.
 * Sample values here are illustrative and never shown to users.
 */
import {
  ArchiveBoxIcon,
  DocumentArrowDownIcon,
  EllipsisHorizontalIcon,
  InboxIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { Alert } from '../components/ui/Alert.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { ConfirmDialog, Drawer, Modal } from '../components/ui/Dialog.jsx';
import { Dropdown } from '../components/ui/Dropdown.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { SelectField } from '../components/ui/SelectField.jsx';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton.jsx';
import { Tabs } from '../components/ui/Tabs.jsx';
import { DatePicker, PasswordField, TextArea, TextField } from '../components/ui/TextField.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { Tooltip } from '../components/ui/Tooltip.jsx';

const SAMPLE_ROWS = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  label: ['Électricité', 'Eau', 'Internet', 'Loyer', 'Téléphone'][i % 5],
  date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
  amount: 120 + ((i * 137) % 900),
}));
const PAGE_SIZE = 5;
const money = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' });
const day = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeZone: 'UTC' });

function Section({ id, title, children }) {
  return (
    <Card as="section" aria-labelledby={id}>
      <CardHeader title={title} titleId={id} />
      {children}
    </Card>
  );
}

export function UiGallery() {
  const toast = useToast();
  const [tab, setTab] = useState('month');
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...SAMPLE_ROWS].sort((a, b) => (a[sort.key] > b[sort.key] ? factor : -factor));
  }, [sort]);
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Design system</h1>
        <p className="mt-2 text-ink-muted">Galerie de développement — absente de la production.</p>
      </header>

      <Section id="buttons" title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="danger">Danger</Button>
          <Button loading loadingLabel="Enregistrement…">
            Enregistrer
          </Button>
          <Button disabled>Désactivé</Button>
          <Button size="sm">
            <PlusIcon aria-hidden="true" className="size-4" />
            Petit
          </Button>
          <Tooltip content="Ajouter une dépense">
            <Button size="icon" variant="secondary" aria-label="Ajouter">
              <PlusIcon aria-hidden="true" className="size-5" />
            </Button>
          </Tooltip>
        </div>
      </Section>

      <Section id="badges" title="Badges et alertes">
        <div className="flex flex-wrap gap-2">
          <Badge>Membre</Badge>
          <Badge tone="brand">Administrateur</Badge>
          <Badge tone="accent">Propriétaire</Badge>
          <Badge tone="success">Payée</Badge>
          <Badge tone="warning">Bientôt due</Badge>
          <Badge tone="danger">En retard</Badge>
        </div>
        <div className="mt-4 space-y-3">
          <Alert tone="info">Information neutre pour la famille.</Alert>
          <Alert tone="success">Facture marquée comme payée.</Alert>
          <Alert tone="error">Impossible d’enregistrer la dépense.</Alert>
        </div>
      </Section>

      <Section id="fields" title="Champs">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Libellé" placeholder="Ex. : Courses du samedi" />
          <TextField label="Montant" inputMode="decimal" error="Saisissez un montant positif." />
          <PasswordField label="Mot de passe" hint="Au moins 12 caractères." />
          <SelectField
            label="Catégorie"
            options={[
              { value: 'food', label: 'Alimentation' },
              { value: 'home', label: 'Maison' },
            ]}
          />
          <DatePicker label="Échéance" defaultValue="2026-11-30" />
          <TextArea label="Notes" rows={3} />
        </div>
      </Section>

      <Section id="overlays" title="Fenêtres, menus et notifications">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            Ouvrir une fenêtre
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Ouvrir un panneau
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Supprimer…
          </Button>
          <Button variant="secondary" onClick={() => toast.success('Dépense enregistrée.')}>
            Notification
          </Button>
          <Dropdown
            label="Actions de la facture"
            triggerContent={<EllipsisHorizontalIcon aria-hidden="true" className="size-5" />}
            triggerProps={{ size: 'icon', variant: 'secondary' }}
            items={[
              { id: 'edit', label: 'Modifier', icon: PencilSquareIcon, onSelect: () => {} },
              { id: 'export', label: 'Exporter', icon: DocumentArrowDownIcon, onSelect: () => {} },
              {
                id: 'archive',
                label: 'Archiver',
                icon: ArchiveBoxIcon,
                disabled: true,
                onSelect: () => {},
              },
              {
                id: 'delete',
                label: 'Supprimer',
                icon: TrashIcon,
                tone: 'danger',
                onSelect: () => setConfirm(true),
              },
            ]}
          />
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Nouvelle dépense"
          description="Ajoutée au budget du mois en cours."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)}>
                Annuler
              </Button>
              <Button onClick={() => setModal(false)}>Ajouter</Button>
            </>
          }
        >
          <TextField label="Libellé de la dépense" />
        </Modal>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Filtres">
          <div className="space-y-4">
            <DatePicker label="Du" />
            <DatePicker label="Au" />
          </div>
        </Drawer>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
          title="Supprimer cette facture ?"
          message="Cette action est définitive."
          confirmLabel="Supprimer"
        />
      </Section>

      <Section id="tabs" title="Onglets">
        <Tabs
          label="Vue du calendrier"
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: 'month',
              label: 'Mois',
              content: <p className="text-ink-muted">Vue mensuelle.</p>,
            },
            {
              id: 'week',
              label: 'Semaine',
              content: <p className="text-ink-muted">Vue hebdomadaire.</p>,
            },
            { id: 'day', label: 'Jour', content: <p className="text-ink-muted">Vue du jour.</p> },
          ]}
        />
      </Section>

      <Section id="table" title="Tableau et pagination">
        <div className="space-y-4">
          <DataTable
            caption="Factures"
            columns={[
              { key: 'label', header: 'Libellé', sortable: true, primary: true },
              {
                key: 'date',
                header: 'Échéance',
                sortable: true,
                render: (row) => day.format(new Date(row.date)),
              },
              {
                key: 'amount',
                header: 'Montant',
                sortable: true,
                align: 'end',
                render: (row) => <span className="tabular-nums">{money.format(row.amount)}</span>,
              },
            ]}
            rows={pageRows}
            getRowKey={(row) => row.id}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
          <Pagination
            page={page}
            pageCount={Math.ceil(SAMPLE_ROWS.length / PAGE_SIZE)}
            onPageChange={setPage}
          />
        </div>
      </Section>

      <Section id="states" title="États de chargement et vides">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <SkeletonText lines={3} />
            <LoadingSpinner label="Chargement…" />
          </div>
          <EmptyState
            icon={InboxIcon}
            title="Aucune dépense ce mois-ci"
            description="Ajoutez votre première dépense pour suivre le budget de la famille."
            action={<Button size="sm">Ajouter une dépense</Button>}
          />
        </div>
      </Section>
    </main>
  );
}
