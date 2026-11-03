import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '../components/ui/Card.jsx';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Card as="section" aria-labelledby="not-found-title" className="space-y-4 text-center">
      <h1 id="not-found-title" className="text-2xl font-semibold">
        {t('notFound.title')}
      </h1>
      <p className="text-ink-muted">{t('notFound.body')}</p>
      <Link to="/" className="font-medium text-accent underline-offset-4 hover:underline">
        {t('notFound.home')}
      </Link>
    </Card>
  );
}
