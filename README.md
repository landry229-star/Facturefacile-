# FactureFacile Bénin

MVP SaaS de facturation pour les petites entreprises béninoises.

## Stack

- Vite, React et TypeScript
- Supabase Auth + PostgreSQL (`supabase/schema.sql`)
- Vercel pour le déploiement frontend

## Développement local

```bash
npm install
cp .env.example .env.local
# renseigner les variables Supabase obligatoires dans .env.local
npm run dev
```

Le schéma SQL peut être exécuté dans **Supabase → SQL Editor**. Les policies RLS isolent les données par propriétaire d'entreprise.

## Application mobile (PWA)

Après déploiement sur un domaine HTTPS, ouvrez le site sur le téléphone pour l'ajouter à l'écran d'accueil. Sur Android, utilisez le bouton **Installer** de l'application ou le menu du navigateur. Sur iPhone/iPad, ouvrez le site dans Safari, touchez **Partager**, puis **Sur l’écran d’accueil**. L'icône reprend le logo officiel sans le redessiner.

La PWA met en cache son interface et affiche un écran hors connexion si le réseau est indisponible. La connexion et les données de facturation nécessitent toujours Internet pour communiquer avec Supabase ; aucune donnée métier n'est synchronisée hors ligne.

## Configuration Supabase

1. Créer un projet Supabase.
2. Dans **SQL Editor**, exécuter tout le contenu de `supabase/schema.sql`.
3. Si vous activez les factures récurrentes, exécuter ensuite `supabase/migrations/20260906100700_recurring_invoices.sql`.
4. Pour automatiser l'émission, exécuter ensuite `supabase/migrations/20260906100500_recurring_invoice_automation.sql`.
5. Pour consulter l'historique des traitements, exécuter ensuite `supabase/migrations/20260906100600_recurring_invoice_runs.sql`.
6. Dans **Project Settings → API**, copier l'URL du projet et la clé `anon` publique.
7. Les placer dans `.env.local` :

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique
```

Supabase est obligatoire : si ces deux variables sont absentes, l'application affiche une page de configuration et n'essaie pas de se connecter. À la première connexion, FactureFacile crée automatiquement l'entreprise du compte. Les factures sont ensuite chargées depuis PostgreSQL. Ne jamais utiliser la clé `service_role` dans Vite ou Vercel.

Tout utilisateur connecté peut modifier son mot de passe depuis **Mon compte** dans le menu latéral. Le nouveau mot de passe doit contenir au moins huit caractères et sa confirmation doit correspondre.

### Paiement des abonnements

Les formules `Starter` et `Pro` sont payées avec le widget KKiaPay. Le widget s’ouvre dans l’application ; le backend vérifie ensuite la transaction auprès de KKiaPay avant d’activer la formule. La configuration, le déploiement et les tests sont décrits dans la section **Configuration KKiaPay** ci-dessous.

Les clés privées KKiaPay et la clé `service_role` restent exclusivement dans les secrets Supabase. Seule la clé publique KKiaPay est transmise au navigateur depuis une Edge Function authentifiée ; aucune clé de paiement ne doit être ajoutée à Vercel ou à une variable `VITE_*`.

### Éditeur de l’espace public

La console plateforme contient la section **Espace public**. Elle reprend les blocs visibles de la page publique : navigation, hero, publics ciblés, solutions, étapes, appel à l’action, pied de page, contact et textes légaux. Seul le rôle `super_admin` peut enregistrer ces modifications ; cette règle est contrôlée par la fonction PostgreSQL `update_public_site_config`, pas seulement par l’interface.

Après application de `supabase/migrations/20260907297000_public_site_editor.sql`, les changements enregistrés sont servis publiquement par `get_public_site_config`. Les contenus FAQ, fonctionnalités, plans, annonces, articles et ressources restent gérés séparément avec leurs états brouillon, publié et archivé.

### Vérification des intégrations

La section **Intégrations** affiche pour chaque service son nom, son type, son environnement, son statut (`connecté`, `opérationnel`, `non configuré`, `attention` ou `indisponible`), son état de connexion et la date de dernière vérification. La RPC `list_platform_integrations` ne renvoie pas la colonne `metadata` : les clés et credentials ne sont donc jamais exposés au frontend.

### Health / état de la plateforme

La section **Health** exécute la RPC sécurisée `check_platform_health` et contrôle les huit composants essentiels : application, PostgreSQL, stockage, génération PDF, e-mail, paiement, API et notifications. Chaque résultat indique `opérationnel`, `attention` ou `incident`, avec un message explicatif, l’heure du check et la latence lorsqu’elle est mesurable. Le bouton **Vérifier maintenant** relance le contrôle côté Supabase ; il ne simule pas un résultat côté navigateur.

### Incidents techniques

La section **Incidents** permet de créer un incident avec titre, description, service, gravité, date de début automatique et responsable (l’administrateur connecté). Le cycle est conservé côté serveur avec les statuts `detected`, `investigating`, `identified`, `fixing`, `verifying` et `resolved`. Après résolution, un compte rendu obligatoire conserve la cause racine, la résolution appliquée et les actions préventives via `update_platform_incident_report`.

### Recherche globale plateforme

La barre supérieure de la console appelle `search_platform_global` après deux caractères et regroupe les résultats par **Entreprises**, **Utilisateurs**, **Abonnements**, **Transactions**, **Tickets** et **Incidents**. La RPC applique la permission Supabase de chaque catégorie avant de retourner les résultats ; le frontend ne peut donc pas contourner les droits de l’administrateur.

### Profil de l’administrateur

La section **Mon profil** permet de modifier le prénom, le nom, l’adresse e-mail, la photo, le mot de passe et les préférences de notifications, langue et densité d’affichage. La photo est stockée dans le bucket Supabase `admin-avatars`, avec un chemin limité à l’utilisateur connecté. La page affiche également la dernière connexion, les sessions récentes disponibles et l’état préparatoire de l’authentification renforcée. Les credentials et tokens ne sont jamais affichés.

### Paramètres de la plateforme

La section **Paramètres** est organisée en cinq catégories : généraux (nom, logo par URL, support et informations), notifications (e-mails, système et alertes), sécurité (durée de session et règles de connexion), abonnements (plans et règles commerciales) et système (fuseau horaire, maintenance et génération PDF). Seules des clés explicitement autorisées sont enregistrées par `update_platform_setting`; les secrets, clés API et credentials restent dans les variables sécurisées de Supabase, Vercel ou des Edge Functions.

Les plans actifs du module **Abonnements** sont également publiés dans la section **Tarifs** de l’espace public. La RPC anonyme `list_public_subscription_plans` ne retourne que les informations commerciales non sensibles : nom, description, prix, devise, périodicité et fonctionnalités.

Le fichier `supabase/schema.sql` inclut aussi le module **Dépenses**. Si le schéma a déjà été exécuté avant cet ajout, réexécuter la partie `expenses` et sa policy dans Supabase SQL Editor.

Les dépenses enregistrent aussi le fournisseur et le moyen de paiement, et acceptent un justificatif PDF ou image JPEG/PNG/WEBP (10 Mo maximum). Les justificatifs sont privés dans le bucket `expense-receipts` et ne sont ouverts qu’avec un lien temporaire après vérification des droits de l’entreprise. Pour une base existante, appliquer `supabase/migrations/20261018003000_expense_receipts_supplier_payment.sql` avant d’utiliser ces champs et téléversements. Les exports CSV, Excel et PDF reprennent le fournisseur, le moyen de paiement et la présence d’un justificatif.

La page **Mon entreprise** conserve les consignes de règlement (`payment_instructions`) et la mention complémentaire des factures (`invoice_legal_notice`). Elles sont rendues dans l’impression et le PDF après application de `supabase/migrations/20261019006000_business_invoice_payment_details.sql`. Si cette version est déjà inscrite dans l’historique Supabase mais que les colonnes sont absentes, `supabase/migrations/20261019010000_repair_business_invoice_payment_details.sql` les ajoute de façon idempotente. Le logo est limité à PNG/JPEG/WEBP, 2 Mo et 5 000 × 5 000 pixels, avec contrôle de sa signature réelle et de son décodage avant téléversement. L’aperçu d’entreprise reprend la mise en page du PDF avec des données d’exemple ; il ne remplace pas une validation des mentions légales et fiscales au Bénin.

Les **Paramètres** de facturation définissent le délai, le taux de taxe, la devise par défaut, le fuseau horaire de l’entreprise (Bénin par défaut) et le format des prochains numéros de facture. La langue de l’application est actuellement le français. Appliquez `supabase/migrations/20261019007000_business_invoice_preferences.sql` après les migrations précédentes pour activer ces réglages et l’instantané de devise sur chaque nouvelle facture. Le délai, le taux et la devise modifiés ne recalculent pas les factures déjà émises ; le format de numéro concerne aussi les prochaines factures récurrentes. Les factures antérieures à l’instantané de devise sont initialisées avec la devise courante de l’entreprise : si cette devise a changé auparavant, la devise historique réelle ne peut pas être reconstituée automatiquement.

**Mon compte** permet de modifier le nom complet, le téléphone de contact et la photo du profil personnel (nom, téléphone et URL photo sont stockés dans les métadonnées du compte Supabase), de changer l’e-mail avec confirmation, d’envoyer un lien de récupération de mot de passe, de révoquer les autres sessions, d’exporter les données métier accessibles en JSON et de transmettre une demande de suppression examinée manuellement par le support. Les coordonnées du profil sont distinctes de celles de l’entreprise. Les photos acceptées sont PNG, JPEG et WEBP, jusqu’à 2 Mo et 5 000 × 5 000 pixels ; le bucket est publiquement lisible et chaque utilisateur ne peut écrire que dans son propre dossier. Appliquez `supabase/migrations/20261019011000_user_profile_photos.sql` pour créer ce stockage. L’export exclut les secrets d’authentification et les contenus binaires des justificatifs. Une demande de suppression ne supprime rien automatiquement, notamment les données partagées d’une entreprise ou les pièces soumises à conservation. L’authentification multifacteur utilise TOTP (application d’authentification, sans abonnement externe) ; appliquez `supabase/migrations/20261019008000_mfa_enforcement.sql` après les autres migrations. Cette migration impose AAL2 aux requêtes RLS uniquement aux utilisateurs ayant un facteur MFA vérifié, en plus du contrôle d’accès côté interface.

Le **Centre d’aide** comprend une FAQ recherchable, des guides par module, un formulaire de support, la consultation des tickets associés au compte et le suivi/réponse par code. Appliquez `supabase/migrations/20261019009000_account_support_replies.sql` pour autoriser les réponses aux tickets authentifiés, strictement limités à leur auteur. Le code de suivi communiqué à la création doit être conservé pour consulter ou répondre à un ticket en dehors de la session courante.

Les données de démonstration statiques ne sont pas utilisées pour remplir le module Dépenses : celui-ci affiche uniquement les enregistrements réels accessibles dans Supabase. Les dépenses récurrentes et la validation à plusieurs étapes ne sont pas encore prises en charge.

### Assistant IA : données, confidentialité et limites

L’Edge Function `ai-assistant` transmet à l’API OpenAI uniquement les données nécessaires à l’action choisie : questions (jusqu’à 240 factures et 240 dépenses récentes), prévisions (séries mensuelles dérivées de ces mêmes plafonds et jusqu’à 100 résumés de facture), analyse des dépenses (jusqu’à 240 dépenses) ou brouillon de facture (description saisie et jusqu’à 240 produits/services du catalogue). Ces données sont lues dans l’entreprise autorisée par les droits Supabase. Les autres catégories ne sont pas envoyées pour l’action en cours. Pour les prévisions, les factures sont ventilées par date d’émission hors brouillons/annulations, les encaissements rapprochés par date de paiement (montant net des remboursements), et les dépenses par date de dépense ; le flux net est encaissements moins dépenses.

Les questions, descriptions et réponses ne sont pas enregistrées dans l’application et restent en mémoire de l’écran pendant la session. L’API externe reçoit le texte et les données pertinentes pour générer le résultat ; sa politique et ses conditions de conservation s’appliquent. N’incluez pas d’informations personnelles ou confidentielles qui ne sont pas nécessaires. Les compteurs de requêtes, sans contenu des échanges ni données financières, sont nettoyés lors d’une requête suivante lorsqu’ils dépassent 90 jours.

Une limite serveur de 20 requêtes par jour UTC et par compte est appliquée, toutes entreprises confondues. La migration `20261019005000_ai_assistant_usage_limits.sql` installe le compteur privé et sa RPC réservée au rôle de service. Appliquez les migrations avec `supabase db push --include-all`, puis redéployez la fonction mise à jour avec `supabase functions deploy ai-assistant`.

Les prévisions sont indicatives : elles extrapolent des données récentes (au plus 240 factures et 240 dépenses) et peuvent ignorer les événements exceptionnels, les variations saisonnières et les changements futurs. Elles ne représentent pas un solde de trésorerie ni un conseil comptable. Les montants et lignes d’un brouillon de facture doivent toujours être vérifiés et complétés par l’utilisateur ; l’assistant ne crée ni n’envoie de facture.

Le suivi de stock ajoute `stock_quantity`, `low_stock_threshold` et `stock_movements` aux produits. Réexécuter également ces instructions de `schema.sql` si la base existait déjà.

L'historique **Stock** affiche l'identifiant du mouvement, le produit et sa référence, le type, la quantité, le stock avant/après, le fournisseur éventuel, la note et la date/heure. Les colonnes `previous_stock`, `new_stock` et `created_by` sont ajoutées par `supabase/migrations/20260909161000_detailed_stock_movements.sql`; exécutez cette migration si la base existe déjà. Lorsqu'une facture est créée pour un produit, une sortie de stock de 1 unité est enregistrée automatiquement. Les services ne modifient pas le stock.

Le module stock propose l'inventaire physique avec rapprochement entre quantité théorique et quantité comptée, le suivi du fournisseur sur les entrées et la valorisation indicative au coût d'achat courant (`quantité × prix d'achat`). Le seuil déclenche une alerte quand la quantité est inférieure ou égale à la valeur configurée; un seuil de zéro ne signale donc que la rupture. L'application gère actuellement un seul dépôt par entreprise.

Le catalogue calcule la marge par produit (`prix de vente - prix d'achat`) et permet d'exporter en CSV, Excel et PDF. Les fichiers CSV/Excel utilisant les colonnes du catalogue peuvent être réimportés avec validation des prix et du stock. Les images produit sont stockées dans le bucket Supabase `product-images`; exécutez `supabase/migrations/20260909162000_product_images.sql` avant d'utiliser l'import d'images.

Les mouvements de stock sont appliqués atomiquement par la RPC `apply_stock_movement`, créée dans `supabase/migrations/20260909171000_atomic_stock_movements.sql`. Cette fonction verrouille le produit, recalcule le stock réel côté PostgreSQL et écrit le mouvement et le stock final dans la même transaction. Exécutez cette migration avant d'enregistrer des mouvements depuis l'application.

La migration `supabase/migrations/20261018002000_stock_inventory_and_supplier_tracking.sql` ajoute le fournisseur aux entrées et permet d'enregistrer également un comptage physique sans écart. Elle met à jour la RPC atomique : les mouvements concurrents sur un même produit sont sérialisés par verrouillage de ligne; un stock négatif est refusé.

Les alertes de stock sont persistantes depuis `supabase/migrations/20260909180000_persistent_stock_alerts.sql`. Un trigger crée ou réactive une alerte lorsque le stock atteint le seuil, la conserve comme lue/non lue dans le tableau de bord et la désactive lorsque le stock revient à un niveau normal. L'envoi par e-mail reste optionnel et nécessite un worker de notifications ainsi qu'un fournisseur e-mail configuré ; aucune alerte n'est envoyée par e-mail par défaut.

La numérotation atomique des factures est disponible via `supabase/migrations/20260906100300_invoice_numbering.sql`. Exécutez cette migration après `schema.sql` pour éviter les doublons lors de créations simultanées.

Le fichier `supabase/rls-tests.sql` couvre également l'isolation des compteurs, des factures récurrentes et des mouvements de stock entre entreprises. Les migrations sont rejouables : leurs tables, policies et fonctions existantes ne sont pas recréées en double.

## Automatisation des factures récurrentes

Déployer la fonction avec la Supabase CLI :

```bash
supabase functions deploy process-recurring-invoices --no-verify-jwt
```

Configurez un cron Supabase/pg_cron quotidien qui appelle l'URL de la fonction en `POST` avec `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. La clé `service_role` reste uniquement dans Supabase Cron/Edge Functions et ne doit jamais être ajoutée à Vite ou Vercel. Chaque exécution est verrouillée, crée les factures échues, décrémente le stock des produits et avance la prochaine date.

Appliquez ensuite `supabase/migrations/20261018130000_recurring_invoice_failure_policy.sql`. Les échecs liés à l'abonnement, au stock ou à une erreur technique conservent l'échéance concernée et provoquent une nouvelle tentative quotidienne, jusqu'à trois échecs consécutifs. Après le troisième échec, la récurrence est suspendue, le motif est historisé et une alerte est publiée dans les notifications de l'entreprise. Un membre autorisé peut corriger la cause puis choisir **Relancer maintenant**; seule une échéance arrivée à terme est alors traitée. La migration `20261029001000_retry_missed_recurring_invoices.sql` permet également le traitement manuel d'une échéance active en retard sans exécution connue. Le serveur refuse la reprise si une exécution non échouée existe déjà pour cette date. Les limites mensuelles restent des échéances ignorées et avancées à la période suivante. Les exécutions et tentatives sont historisées dans `recurring_invoice_runs` (`issued`, `skipped_stock`, `skipped_subscription` ou `failed`).

Le cron doit être effectivement configuré et fonctionner pour les nouvelles tentatives automatiques; l'action manuelle est disponible dans Factures récurrentes et Historique automatisation pour les échéances déjà arrivées.

Les factures ont une date d'échéance obligatoire par défaut à 30 jours. Une facture non payée dont l'échéance est dépassée est affichée comme impayée/en retard.

Les factures de la Version 5 acceptent plusieurs lignes, des quantités, une réduction fixe et un taux de taxe. Le PDF imprimable affiche le sous-total, la réduction, la taxe et le total.

La création d'une facture Version 5 est transactionnelle côté PostgreSQL : les lignes, taxes, réduction et mouvements de stock sont validés ou annulés ensemble. Exécutez `supabase/migrations/20260906100400_invoice_transaction.sql` après les autres migrations.

La Version 6 ajoute des alertes réelles dans le centre de notifications pour les factures échues et les stocks sous leur seuil. Aucune donnée de démonstration n'est utilisée.

Les préférences de facturation (délai, taxe et devise) sont disponibles dans **Paramètres** après exécution de `supabase/migrations/20260906100100_business_preferences.sql`.

La Version 7 ajoute le journal d'audit. Exécutez `supabase/migrations/20260906_audit_logs.sql` pour tracer les actions métier et consulter le module **Journal d’audit**. La migration `20261019003000_audit_immutability_actor_search.sql` retire la modification directe des journaux et fournit une lecture filtrable avec un libellé d’acteur sans exposer les données d’authentification directement au navigateur. La migration `20261019004000_confirmed_audit_log_deletion.sql` ajoute la suppression réservée au propriétaire ou à un administrateur via une RPC contrôlée; le navigateur demande confirmation et une trace append-only de maintenance conserve l’identité, la cible et la date de la suppression.

La gestion d’équipe nécessite aussi `supabase/migrations/20260906101100_team_members.sql`. Elle prépare les invitations et rôles `admin`, `member` et `viewer`.

L’acceptation des invitations nécessite ensuite `supabase/migrations/20260906100900_team_invitations_acceptance.sql`. Le collaborateur doit être connecté avec l’adresse email invitée et saisir le token fourni par l’administrateur.

Enfin, exécutez `supabase/migrations/20260906100800_team_access_policies.sql` pour appliquer les rôles : `viewer` peut consulter, `member` peut consulter et modifier les données métier, et `admin` dispose des mêmes droits avec la gestion d’équipe réservée au propriétaire.

La gestion de Version 7 permet également d’annuler une invitation ou de retirer un membre via `supabase/migrations/20260906101000_team_management.sql`.

## Notifications plateforme : configuration des envois

Le centre de notifications fonctionne avec trois niveaux :

- **Interface** : les notifications sont enregistrées dans Supabase et reçues en temps réel dans la cloche grâce à Supabase Realtime.
- **E-mail** : les notifications placées dans la file sont envoyées par `process-platform-notification-deliveries` via Resend.
- **SMS et webhook** : les préférences et la file sont prévues, mais un fournisseur et une intégration dédiés sont nécessaires avant l’envoi réel.

### Procédure complète, étape par étape

#### Étape 1 — Préparer Resend

1. Créez un compte sur [Resend](https://resend.com/).
2. Ajoutez et vérifiez le domaine de l’adresse expéditrice.
3. Créez une clé API Resend dédiée à l’envoi.
4. Conservez cette clé dans un gestionnaire de secrets.

#### Étape 2 — Appliquer les migrations

```bash
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push --include-all
```

La migration `20260907270700_platform_notification_delivery.sql` crée la file d’envoi, les tentatives et le journal des erreurs.

#### Étape 3 — Configurer les secrets Supabase

Ne placez jamais ces valeurs dans `.env.local`, dans Vite ou dans Vercel. Elles doivent rester dans les secrets Supabase :

| Secret | Utilisation |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase, fournie automatiquement par l’environnement Edge |
| `SUPABASE_SERVICE_ROLE_KEY` | accès serveur de la fonction, jamais exposé au navigateur |
| `RESEND_API_KEY` | clé API Resend pour les e-mails |
| `EMAIL_FROM` | adresse expéditrice vérifiée dans Resend |
| `NOTIFICATION_WORKER_SECRET` | secret partagé entre le cron et le worker |

Générez un secret worker aléatoire, puis configurez les secrets :

```bash
openssl rand -hex 32
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  EMAIL_FROM=notifications@votre-domaine.com \
  NOTIFICATION_WORKER_SECRET=COLLEZ_ICI_UN_SECRET_LONG
supabase secrets list
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement à la fonction Edge. Ne les copiez jamais dans `.env.local`, Vite ou Vercel.

La migration `20260907270700_platform_notification_delivery.sql` crée la file d'envoi, les tentatives et le journal des erreurs. Le worker traite au maximum 25 éléments par appel et réessaie jusqu'à 5 fois avec un délai progressif.

#### Étape 4 — Déployer le worker

```bash
supabase functions deploy process-platform-notification-deliveries
```

#### Étape 5 — Tester manuellement le worker

Remplacez les valeurs d’exemple avant d’exécuter :

```bash
curl -i -X POST "https://VOTRE_PROJET.supabase.co/functions/v1/process-platform-notification-deliveries" \
  -H "x-notification-worker-secret: COLLEZ_ICI_UN_SECRET_LONG"
```

Une réponse `200` indique que la file a été traitée. Consultez ensuite les statuts `sent`, `pending` et `failed` de `platform_notification_deliveries` dans Supabase.

#### Étape 6 — Programmer l’exécution

Configurez un cron Supabase, GitHub Actions ou Vercel Cron toutes les 1 à 5 minutes. Il doit envoyer la même requête `POST` avec l’en-tête secret.

Le secret doit être transmis uniquement par le cron, jamais dans le frontend, une URL ou un dépôt Git.

#### Étape 7 — Vérifier les erreurs

Une livraison `failed` conserve `attempts`, `last_error` et `next_attempt_at`. Après 5 tentatives, elle reste en échec jusqu’à correction de la configuration. Vérifiez le domaine `EMAIL_FROM`, la clé Resend, le secret du cron, les migrations et l’adresse e-mail du destinataire.

### Pourquoi la réponse `401` ?

`401` signifie **Unauthorized / non authentifié**. Le worker refuse volontairement toute requête qui ne contient pas l’en-tête `x-notification-worker-secret` avec la bonne valeur.

Cela empêche une personne externe de déclencher arbitrairement des e-mails. Une requête sans secret, avec un mauvais secret, ou lorsque `NOTIFICATION_WORKER_SECRET` n’est pas configuré reçoit `401 Non autorisé`. Avec le bon secret, le worker peut traiter la file ; il signalera ensuite une erreur de configuration si Resend ou l’adresse expéditrice manquent.

Ne committez jamais `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ou `NOTIFICATION_WORKER_SECRET`.

Le module **Abonnement** utilise `supabase/migrations/20260906100200_business_subscriptions.sql` puis `supabase/migrations/20260907_subscription_limits.sql`. La seconde migration initialise automatiquement le plan `free` pour les entreprises existantes et futures, affiche le nombre de factures du mois et bloque atomiquement toute nouvelle facture lorsque la limite du plan est atteinte. Le propriétaire peut choisir le plan gratuit depuis l’interface ; les plans Starter et Pro ne sont activés qu’après confirmation d’un paiement KKiaPay côté serveur. L’écran Équipe masque aussi les invitations, annulations et retraits aux rôles non propriétaires. Elle doit être exécutée après les migrations d’équipe, car elle réutilise `is_business_member`. Les liens d’invitation sélectionnent désormais automatiquement l’entreprise membre après authentification.

La migration `supabase/migrations/20260908_recurring_subscription_limits.sql` applique également les limites d’abonnement aux factures récurrentes automatisées. Les traitements bloqués sont enregistrés avec le statut `skipped_subscription` et apparaissent distinctement dans **Historique automatisation**. Cet historique est également consultable par les membres d’équipe autorisés en lecture. Les changements d’abonnement sont tracés dans le **Journal d’audit**.

Les factures récurrentes sont accessibles à tout membre autorisé d’une entreprise ayant un abonnement Starter, Pro ou Business actif. Les règles RLS et le traitement automatique refusent les abonnements gratuits, inactifs ou expirés.

### Configuration KKiaPay

Les paiements concernent uniquement les formules **Starter** et **Pro**. Créez un compte marchand KKiaPay et utilisez les clés Sandbox pour tester, puis les clés de production lorsque le compte est activé.

1. Liez le projet avec `supabase link --project-ref VOTRE_PROJECT_REF` et appliquez les migrations avec `supabase db push --include-all`. La migration `20261017120000_switch_subscription_payments_to_kkiapay.sql` annule les paiements PayDunya encore en attente et impose une confirmation serveur KKiaPay avant activation.
2. Configurez les secrets uniquement dans Supabase :

```bash
supabase secrets set \
  KKIAPAY_PUBLIC_KEY="VOTRE_CLE_PUBLIQUE" \
  KKIAPAY_PRIVATE_KEY="VOTRE_CLE_PRIVEE" \
  KKIAPAY_SECRET_KEY="VOTRE_CLE_SECRETE" \
  KKIAPAY_WEBHOOK_SECRET="VOTRE_SECRET_HASH_WEBHOOK" \
  KKIAPAY_SANDBOX="true"
```

Utilisez `KKIAPAY_SANDBOX="false"` avec les clés de production. Supabase fournit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` aux Edge Functions. Ne mettez aucune clé privée ni le secret webhook dans Vite, Vercel ou Git.

3. Déployez les fonctions :

```bash
supabase functions deploy create-subscription-checkout
supabase functions deploy verify-kkiapay-subscription-payment
supabase functions deploy kkiapay-subscription-webhook --no-verify-jwt
```

4. Dans le tableau de bord KKiaPay, configurez l’URL webhook suivante et utilisez le même secret hash que `KKIAPAY_WEBHOOK_SECRET` :

```text
https://VOTRE_PROJECT_REF.supabase.co/functions/v1/kkiapay-subscription-webhook
```

5. Testez avec un compte propriétaire : **Abonnement → Starter ou Pro** ouvre le widget KKiaPay. Après paiement, l’application et le webhook demandent tous deux une vérification serveur. La formule n’est activée que si KKiaPay confirme un débit réussi du montant attendu avec le `partnerId` de la tentative.

Une tentative en attente de moins de 24 heures est réutilisée ; les plus anciennes expirent. La confirmation est idempotente et une transaction ne peut activer qu’un seul paiement. Il n’y a pas de cron de réconciliation : la confirmation se fait au retour du widget et via le webhook. Les scénarios RLS sont dans `supabase/rls-tests.sql`.

Les paiements d’abonnement n’exposent aucune policy d’insertion ou de modification côté client : seules les Edge Functions avec `service_role` peuvent créer et finaliser un paiement. Les tests RLS couvrent aussi ces tentatives directes.

Le propriétaire ne peut pas activer manuellement une formule payante. KKiaPay est vérifié côté serveur avant l’activation ; le webhook est signé et le navigateur ne transmet jamais une confirmation suffisante à lui seul.

À l’échéance exacte de l’abonnement, l’application repasse au plan gratuit et masque les fonctionnalités payantes, même si l’onglet reste ouvert ou revient du mode veille. Les opérations sensibles de facturation, de stock, de récurrence et de gestion de l’équipe vérifient aussi l’abonnement actif côté Supabase.

Supprimez ou désactivez dans Supabase les anciennes fonctions `paydunya-subscription-webhook` et `reconcile-subscription-payments`, ainsi que tout cron de réconciliation PayDunya. Leur code source n’est plus maintenu dans le dépôt.

## Déploiement Vercel

Importer le dépôt dans Vercel, conserver la commande `npm run build`, puis ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables d'environnement.

## Déploiement Render

Le fichier `render.yaml` configure un site statique Render : installation reproductible avec `npm ci`, compilation avec `npm run build`, publication du dossier `dist` et réécriture des routes vers `index.html` pour le routage de l’application. Connectez le dépôt dans Render via **New → Blueprint** pour appliquer cette configuration, puis renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` lors de la création du service. Ces variables sont injectées au moment du build ; ne mettez jamais la clé `service_role` dans les variables frontend.

## Version 7 — terminée

La Version 7 couvre la plateforme multi-utilisateurs et les abonnements SaaS :

- équipe, invitations par lien et rôles `admin`, `member`, `viewer` ;
- contrôle d’accès RLS par entreprise ;
- journal d’audit ;
- plans Free, Starter et Pro avec limites mensuelles ;
- factures récurrentes soumises aux limites d’abonnement ;
- paiements KKiaPay, vérification serveur et webhook signé ;
- historique des paiements et reprise des paiements en attente ;
- tests RLS pour l’isolation des entreprises et des paiements.

Après l’installation et le déploiement décrits ci-dessus, la Version 7 est prête pour les tests métier et le passage en production.

## Version 8 — exports et communication professionnels

La Version 8 commence avec l’export CSV des tableaux Clients, Produits & Services, Paiements, Dépenses, Factures récurrentes, Historique automatisation et Stock. Les fichiers utilisent le séparateur `;`, l’encodage UTF-8 avec BOM et sont générés localement depuis les données déjà chargées dans Supabase.

Le rapport financier dispose aussi d’un export CSV dédié avec les indicateurs de synthèse et le chiffre d’affaires mensuel.

Le graphique du tableau de bord est désormais alimenté par les factures payées réelles des six derniers mois, sans données statiques. Le module Factures charge aussi les factures réelles depuis Supabase, permet la recherche, le filtrage par statut, l’affichage du chargement et l’ouverture de l’édition imprimable de chaque facture.

L’envoi email des factures est disponible via l’Edge Function `send-invoice-email`. Elle vérifie la session et le rôle de l’utilisateur avant d’envoyer un récapitulatif au client via Resend. Configurer les secrets Supabase suivants avant le déploiement :

```bash
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="FactureFacile <factures@votre-domaine.com>"
supabase functions deploy send-invoice-email
```

Le domaine d’envoi doit être vérifié dans Resend. La clé `RESEND_API_KEY` reste uniquement dans Supabase et ne doit jamais être ajoutée à Vercel ou au frontend.

Les relances quotidiennes des factures échues utilisent `invoice_reminders` pour éviter les doublons. Exécuter la migration `20260910_invoice_reminders.sql`, puis configurer :

```bash
export CRON_SECRET="$(openssl rand -hex 32)"
supabase secrets set CRON_SECRET="$CRON_SECRET"
supabase functions deploy send-overdue-reminders
```

`CRON_SECRET` est une valeur que vous générez vous-même. Enregistrez-la dans un gestionnaire de mots de passe : Supabase n'affiche pas la valeur après l'enregistrement. `supabase secrets list` permet seulement de vérifier que le nom du secret existe.

Appeler cette fonction une fois par jour depuis Supabase Cron ou un cron externe avec l’en-tête `x-cron-secret` :

```bash
curl -X POST "https://votre-projet.supabase.co/functions/v1/send-overdue-reminders" \
  -H "x-cron-secret: $CRON_SECRET"
```

Elle ne renvoie jamais les clés Resend au navigateur.

La migration `20261019001000_invoice_communication_audit.sql` ajoute un historique par facture des demandes d’envoi et des relances (acceptées ou en échec), ainsi que les noms des champs modifiés dans le journal d’audit. Après application, la fiche de suivi des factures affiche ces événements. L’état « accepté » confirme uniquement l’acceptation par le prestataire e-mail, pas la livraison ou la lecture. Les relances automatiques restent déclenchées par la fonction quotidienne; aucun envoi automatique n’est lancé depuis le navigateur.

Le module **Historique automatisation** filtre les tentatives par date prévue et résultat, expose le détail et l’identifiant de chaque exécution, et permet d’ouvrir la facture générée. Les échéances actives dont la date est passée sans prochaine date planifiée sont signalées. Une échéance sans exécution connue peut être traitée manuellement après confirmation; la base bloque l'action s'il existe déjà une exécution non échouée pour cette échéance. Toute reprise peut créer une facture ou modifier le stock.

Le module **Rapports** applique la période sélectionnée aux métriques et à tous les exports. Le CA encaissé correspond aux paiements rapprochés nets (remboursements déduits), selon la date de paiement. Le bénéfice net est une estimation de trésorerie calculée comme les encaissements nets moins les dépenses enregistrées, pas un résultat comptable. La taxe correspond au montant enregistré sur les factures émises pendant la période, hors brouillons et annulations; les taux historiques ne sont pas enregistrés, donc le détail par taux est indisponible. Ce chiffre ne remplace pas une déclaration fiscale.

Avant tout usage en production au Bénin, faire valider par un professionnel qualifié les mentions de facture et le processus de conformité fiscale applicables. La génération d’un document dans l’application ne garantit pas sa conformité juridique ou fiscale.

Les migrations de la Version 8 utilisent `create table if not exists`, `add column if not exists`, `create unique index if not exists` et des policies recréables. `supabase db push` n'efface donc pas les tables existantes et n'exécute pas deux fois une migration déjà enregistrée. Si les anciennes tables ont été créées manuellement sans historique Supabase, il faut d'abord faire une sauvegarde et comparer le schéma avant d'exécuter toutes les migrations historiques.

Les migrations historiques de l’équipe, de l’audit, des abonnements et des paiements suppriment également leurs policies nommées avant de les recréer. Cela permet de reprendre un `supabase db push` interrompu par une policy déjà existante, sans supprimer les tables ni leurs données.

Chaque fichier de migration possède désormais un préfixe numérique unique (`20260906100100`, `20260906100200`, etc.). Supabase utilise ce préfixe comme identifiant : deux fichiers ne doivent jamais commencer par le même numéro.

### Checklist de clôture Version 8

- [x] Exports CSV et rapport financier
- [x] Graphique du chiffre d’affaires basé sur Supabase
- [x] Recherche, filtre et impression des factures
- [x] Envoi email via Resend
- [x] Relances quotidiennes idempotentes
- [x] Protection des secrets et écran de configuration Supabase
- [x] Migrations rejouables et versions uniques
- [x] Build, lint et vérification du diff validés

Après `supabase db push`, déployer les deux fonctions email et configurer le cron quotidien. La Version 8 est alors prête pour les tests métier en production.

Les tests automatisés SQL se trouvent dans `supabase/tests/`. Le smoke test global `all-versions-smoke.sql` vérifie les tables, fonctions, RLS, stock, facturation, équipe, abonnements, paiements KKiaPay, audit et relances des Versions 1 à 8. Le test ciblé `version-8-invoice-reminders.sql` vérifie en plus le contrat spécifique des relances. Aucun test n’envoie d’email réel :

```bash
supabase test db
```

Le flux Resend réel doit ensuite être vérifié avec une facture de test et une adresse email contrôlée. Le test SQL ne contacte volontairement aucun service externe.
