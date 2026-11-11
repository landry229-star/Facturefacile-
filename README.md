# FactureFacile Bénin

MVP SaaS de facturation pour les petites entreprises béninoises.

## Stack

- Vite, React et TypeScript
- Supabase Auth + PostgreSQL (`supabase/schema.sql`)
- Vercel pour le déploiement frontend

## État actuel — bases Supabase séparées et intégration DGI

Les environnements doivent rester séparés :

- **Production** : projet `facture` (`jpxtdwljgdapuvlnmdbz`).
- **Test** : projet `bqjhmmmvmhueqismhjfq`, également utilisé par une application d'auto-école.

La base de production contient 3 entreprises et 5 factures. Aucune ligne du registre IFU fictif, facture marquée comme simulation, ni référence NIM/compteur/signature non simulée n'y a été détectée. Aucune donnée métier n'a été déplacée ou supprimée sur cette base.

Le schéma FactureFacile et les migrations du Livrable 2 ont été installés sur le projet de test sans supprimer ses tables existantes ni ses deux comptes Auth préexistants. Cette base partage toutefois le service Supabase Auth avec l'application d'auto-école : les comptes utilisateurs sont communs aux deux applications, tandis que les tables métier FactureFacile sont distinctes et protégées par RLS. Huit IFU de démonstration fictifs sont chargés dans le registre du projet test seulement ; aucune facture FactureFacile fictive n'a été créée.

Le fichier `.env.test.local` pointe vers le projet de test et est ignoré par Git. Les valeurs de Preview et de Production sur Vercel doivent rester séparées. Vérifiez toujours la référence du projet avant d'appliquer un SQL ou de lancer des tests qui écrivent des données.

Le Livrable 1 ajoute le régime fiscal d'entreprise, son instantané sur les factures, le type de pièce, les références NIM/signature/compteur et le registre IFU de démonstration. Le Livrable 2 fournit les mouvements de stock idempotents, la saisie manuelle des références par `save_benin_invoice_metadata` et une simulation DGI explicitement fictive. La saisie manuelle n'authentifie pas les références auprès de la DGI ; les PDF l'indiquent. La simulation n'altère pas le paiement.

La recherche IFU n'interroge aucun service DGI. Aucune intégration e-MECeF/DGI officielle n'est configurée. Les exemples du registre sont fictifs et ne doivent pas être confondus avec des données officielles.

Les données fictives de validation doivent être placées uniquement dans la base de test. Avant l'ouverture au public, désactiver `VITE_DGI_MOCK_IFU_LOOKUP_ENABLED` sur les déploiements publics et appliquer la procédure de nettoyage à la base de production. Elle supprime les lignes du registre de démonstration, les références des factures explicitement marquées `is_dgi_mock = true`, et la RPC de simulation. Elle ne supprime pas les utilisateurs, entreprises, factures, produits, références e-MECeF saisies manuellement, régime fiscal ni type de document.

Pour une intégration DGI réelle, obtenir la documentation technique, les autorisations et un accès officiel de test. Les secrets devront rester côté serveur.

## Développement local

```bash
npm install
cp .env.test .env.test.local
npm run dev
```

`npm run dev` utilise la configuration locale de test. Le schéma SQL peut être exécuté dans **Supabase → SQL Editor**, mais uniquement sur le projet de test pour installer ou vérifier les données de test.

## Application mobile (PWA)

Après déploiement sur un domaine HTTPS, ouvrez le site sur le téléphone pour l'ajouter à l'écran d'accueil. Sur Android, utilisez le bouton **Installer** de l'application ou le menu du navigateur. Sur iPhone/iPad, ouvrez le site dans Safari, touchez **Partager**, puis **Sur l’écran d’accueil**. L'icône reprend le logo officiel sans le redessiner.

La PWA met en cache son interface et affiche un écran hors connexion si le réseau est indisponible. La connexion et les données de facturation nécessitent toujours Internet pour communiquer avec Supabase ; aucune donnée métier n'est synchronisée hors ligne.

## Configuration Supabase

### Séparer test et production

Le fichier `.env.test` est configuré pour le projet de test `bqjhmmmvmhueqismhjfq`. Le projet de production est `facture` (`jpxtdwljgdapuvlnmdbz`). Dans **Project Settings → API** de chaque projet, utilisez uniquement l'URL et la clé publique `anon`/`publishable` correspondantes. Ne placez jamais une clé `service_role`, une clé `secret` ou le mot de passe PostgreSQL dans le frontend, Vercel ou un fichier `VITE_*`.

```bash
cp -n .env.test .env.test.local
```

Conservez dans `.env.test.local` les valeurs du projet de test. Ce projet héberge aussi l'application d'auto-école : ses deux comptes Auth préexistants sont conservés et communs aux deux applications. N'utilisez pas ces comptes pour les essais FactureFacile sans l'accord de leur propriétaire. Configurez Vercel avec les variables du projet de test pour **Preview**, et celles du projet `facture` pour **Production**. Vérifiez la référence du projet avant chaque migration ou action d'administration.

Le schéma FactureFacile a été installé sur le projet test avec la commande suivante. **Ne la relancez pas** sur ce projet déjà initialisé :

```bash
supabase db query --linked --project-ref bqjhmmmvmhueqismhjfq --file supabase/test_only_full_schema.sql
```

Le script `supabase/test_only_full_schema.sql` est un instantané d'installation réservé à une base neuve. Pour une évolution ultérieure, exécutez la migration ciblée d'abord sur le projet test, vérifiez l'application, puis appliquez-la séparément à la production après approbation. Pour charger de nouveau les exemples IFU fictifs (opération non destructive, elle ignore les IFU déjà présents), utilisez uniquement sur le projet test :

```bash
supabase db query --linked --project-ref bqjhmmmvmhueqismhjfq --file supabase/dgi_mock_ifu_seed.sql
```

Pour tester le parcours de bout en bout, connectez-vous à l'application avec un compte dédié à FactureFacile sur la base de test, puis créez une entreprise, un client, un produit et une facture fictifs depuis l'interface. Les utilisateurs Supabase Auth de la base test sont partagés avec l'application d'auto-école ; ne supprimez ni ne réutilisez les comptes préexistants sans autorisation.

N'activez `VITE_DGI_MOCK_IFU_LOOKUP_ENABLED=true` que pour les tests privés sur la base de test. Ne l'activez jamais sur une instance publique. Les tests qui créent des données doivent rester dans le projet de test.

Lancez l'application en mode test :
```bash
npm run dev
```

### Nettoyer la production avant l'ouverture au public

Les données fictives de test doivent rester dans le projet de test et ne doivent pas être copiées en production. Avant le lancement public, désactivez la recherche fictive dans l'environnement Vercel Production et vérifiez que le SQL cible bien `facture` (`jpxtdwljgdapuvlnmdbz`). Comptabilisez d'abord les seules données DGI fictives :

```sql
select
  (select count(*) from public.dgi_mock_ifu_registry) as mock_ifu_rows,
  (select count(*) from public.invoices where is_dgi_mock is true) as mock_invoices,
  (select count(*) from public.invoices
   where is_dgi_mock is not true
     and (dgi_nim is not null or dgi_signature is not null or dgi_counters is not null)
  ) as nonmock_invoice_references;
```

Après vérification, exécutez la commande depuis la racine du dépôt. Elle cible explicitement la production et applique uniquement `supabase/dgi_mock_data_cleanup_before_public.sql` ; elle ne supprime pas les utilisateurs ni les données métier :

```bash
supabase db query --linked --project-ref jpxtdwljgdapuvlnmdbz --file supabase/dgi_mock_data_cleanup_before_public.sql
```

Relancez la requête de comptage : `mock_ifu_rows` et `mock_invoices` doivent être à zéro. Vérifiez la suppression de la fonction simulée :

```sql
select to_regprocedure('public.simulate_dgi_normalisation(uuid)') as simulation_rpc;
```

Le résultat attendu est `NULL`. Les références e-MECeF non marquées comme simulation sont conservées. Le script ne vide pas les factures, entreprises ou utilisateurs de production.

Dans Vercel, gardez des valeurs différentes : projet de test pour **Preview**, projet `facture` pour **Production**. Redéployez après tout changement de variable et vérifiez la référence Supabase dans chaque environnement.

`supabase/test_only_full_schema.sql` reste réservé à une base de test neuve et vide. Les scripts de configuration Livrable 1 et 2 ne sont pas des scripts de nettoyage. Le registre de démonstration n’est pas un bac à sable DGI et ne transmet aucune facture à la DGI.

### Référence de configuration et migrations

Le développement local utilise le mode `test` pour cibler la base séparée :

1. Le mode Vite `test` charge `.env.test.local`, qui doit contenir les valeurs du projet de test.
2. `supabase/test_only_full_schema.sql` est un instantané de préparation pour une base de test vide ; il ne doit pas servir à mettre à jour la production ni une base déjà initialisée.
3. Supabase est obligatoire : sans URL et clé publique, l'application affiche une page de configuration et n'essaie pas de se connecter.

Les variables `VITE_*` sont intégrées au bundle public. N'y placer que l'URL Supabase et la clé publique `anon`/`publishable`, jamais de clé `service_role`, `secret` ou d'identifiants de base de données. Aucune connexion DGI n'est configurée actuellement ; lorsque la documentation et les accès DGI seront disponibles, les secrets DGI devront être stockés côté serveur (par exemple dans les secrets d'une Edge Function Supabase), jamais dans une variable `VITE_*`.

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

Les dépenses enregistrent le fournisseur, son IFU, le numéro de pièce, le montant TTC, la base HT et la TVA lorsqu’ils figurent sur le justificatif. L’image ou le PDF justificatif reste privé dans le bucket `expense-receipts` et n’est ouvert qu’avec un lien temporaire après vérification des droits de l’entreprise. Le QR peut être lu depuis une photo ou par la caméra; son contenu brut est conservé comme référence, sans validation automatique auprès de la DGI. Pour une base existante, appliquer `supabase/migrations/20261018003000_expense_receipts_supplier_payment.sql`, puis `supabase/migrations/20261111193000_expense_dgi_metadata.sql`. Cette dernière migration a été appliquée au projet de test `bqjhmmmvmhueqismhjfq`, pas à la production `jpxtdwljgdapuvlnmdbz`; elle doit y être déployée séparément avant la publication de ces changements. Les filtres de dates et de catégorie permettent de suivre une période, avec des raccourcis pour le mois et l’année en cours. L’export **Préparation DGI** fournit les lignes filtrées, le fournisseur, les identifiants de pièce, la ventilation HT/TVA connue, le montant TTC, la référence QR et la présence du justificatif, avec une ligne de totaux et les ventilations manquantes signalées. Les montants HT/TVA absents ne sont pas estimés; l’export aide à préparer le suivi comptable mais ne constitue pas une déclaration ou une validation de conformité DGI. Les exports CSV, Excel et PDF standards restent disponibles.

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

Le module **Rapports** propose également **Export comptable Bénin** : les factures de la période sélectionnée sont exportées en CSV séparé par `;`, avec BOM UTF-8, dates `JJ/MM/AAAA`, base HT nette de remise, taxe enregistrée, montant, IFU client et règlements associés (moyens, références, dates et montant net rapproché, remboursements déduits). La devise du fichier suit celle de l’entreprise. L’export reprend le régime fiscal, le type de pièce, le NIM et la signature s’ils sont renseignés ; les signatures simulées sont marquées comme telles. Les champs non connus restent vides et aucune référence officielle n’est fabriquée. La mention légale exportée reprend celle configurée dans **Mon entreprise**, ou indique qu’aucune mention n’est configurée. Cet export est un support de préparation comptable, pas une déclaration fiscale ni une certification DGI.

Le graphique du tableau de bord est désormais alimenté par les factures payées réelles des six derniers mois, sans données statiques. Le module Factures charge aussi les factures réelles depuis Supabase, permet la recherche, le filtrage par statut, l’affichage du chargement et l’ouverture de l’édition imprimable de chaque facture.

L’envoi email des factures est disponible via l’Edge Function `send-invoice-email`. Elle vérifie la session et le rôle de l’utilisateur avant d’envoyer un récapitulatif au client via Resend. Configurer les secrets Supabase suivants avant le déploiement :

```bash
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="FactureFacile <factures@votre-domaine.com>"
supabase functions deploy send-invoice-email
```

Le domaine d’envoi doit être vérifié dans Resend. La clé `RESEND_API_KEY` reste uniquement dans Supabase et ne doit jamais être ajoutée à Vercel ou au frontend.

Les relances automatiques restent désactivées par défaut. Appliquez d’abord `supabase/migrations/20261110180000_manual_invoice_reminders.sql` et `supabase/migrations/20261110190000_overdue_reminder_opt_in.sql`, puis exécutez `supabase/tests/manual-invoice-reminders-smoke.sql` dans le projet de test. La migration crée une préférence par entreprise, sans ligne activée par défaut; seuls le propriétaire et les administrateurs peuvent la modifier. Le réglage manuel n’envoie rien tant que la fonction et le cron ci-dessous ne sont pas configurés.

```bash
openssl rand -hex 32
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  EMAIL_FROM="FactureFacile <factures@votre-domaine.com>" \
  CRON_SECRET=COLLEZ_ICI_UN_SECRET_LONG
supabase functions deploy send-overdue-reminders --no-verify-jwt
```

Configurez ensuite un cron Supabase quotidien qui appelle `send-overdue-reminders` avec l’en-tête `x-cron-secret: <CRON_SECRET>`. Conservez ce secret côté serveur (par exemple dans Supabase Vault), jamais dans Vercel ni le navigateur. Sans cron, l’opt-in n’envoie aucun e-mail. La fonction ne sélectionne que les entreprises activées, vérifie à nouveau l’opt-in avant chaque facture échue et bloque les doublons par facture et par jour; elle ignore aussi une facture déjà marquée comme relancée manuellement ce jour-là. Elle exclut les brouillons, annulations, factures payées, proformas et avoirs, et vérifie le solde restant. Un envoi accepté par Resend est inscrit comme accepté, ce qui ne garantit pas sa livraison ou sa lecture. Si l’état d’un envoi est incertain, la réservation du jour est conservée pour éviter un doublon; l’envoi ne sera pas automatiquement retenté le même jour.

La migration `20261019001000_invoice_communication_audit.sql` ajoute un historique par facture des demandes d’envoi email. L’état « accepté » confirme uniquement l’acceptation par le prestataire e-mail, pas la livraison ou la lecture.

Le module **Devis** permet de consulter un devis, de modifier les brouillons ou devis envoyés (l’ancien lien client est alors invalidé), et de supprimer un devis après confirmation. Les devis convertis en facture ne peuvent pas être modifiés ou supprimés. Les actions sont regroupées au-dessus du tableau : après avoir choisi l’action, l’utilisateur recherche et sélectionne le devis dans une liste paginée; les actions non applicables au statut, à la date de validité ou aux coordonnées du client sont désactivées avec leur motif. La création du lien sécurisé affiche ensuite des actions de partage par e-mail ou WhatsApp, avec confirmation explicite dans l’application; WhatsApp demande aussi la confirmation finale dans son application. Création, modification, suppression, partage, acceptation manuelle et conversion sont précédés d’une confirmation intégrée. La page publique du devis inclut l’identité et les coordonnées disponibles de l’entreprise et permet de télécharger le devis en PDF sur une seule page A4. L’e-mail passe par l’Edge Function `send-quote-email`; aucun envoi automatique n’est configuré.

État du déploiement au 11/11/2026 : la migration `supabase/migrations/20261110200000_quote_management.sql` et la fonction `send-quote-email` sont appliquées au projet de test `bqjhmmmvmhueqismhjfq`. La migration `supabase/migrations/20261111173000_public_quote_business_identity.sql` y a également été exécutée; elle ajoute à la réponse publique du devis les coordonnées professionnelles utiles à sa vérification. Elle n’a pas été appliquée à la production `jpxtdwljgdapuvlnmdbz`. Les secrets e-mail (`RESEND_API_KEY`, `EMAIL_FROM` et `APP_URL`) ne sont pas encore configurés : l’envoi e-mail restera indisponible jusqu’à leur ajout. `APP_URL` doit être l’URL HTTPS publique de l’application et le domaine de `EMAIL_FROM` doit être vérifié dans Resend.

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  EMAIL_FROM="FactureFacile <factures@votre-domaine.com>" \
  APP_URL=https://votre-application.vercel.app \
  --project-ref bqjhmmmvmhueqismhjfq
```

Ne placez jamais la clé Resend dans Vercel ni dans le frontend. La production `jpxtdwljgdapuvlnmdbz` n’a pas reçu cette migration ni cette fonction. Après validation et configuration des secrets sur le projet de test, déployer séparément en production : appliquer cette migration, déployer `send-quote-email` avec `--project-ref jpxtdwljgdapuvlnmdbz`, puis y configurer les trois secrets (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`) avec les valeurs et l’URL de production. Publier également le frontend correspondant sur Vercel. Aucun changement de production n’est effectué par cette documentation.

Le module **Caisse et ventes rapides** permet aux membres autorisés d’ajouter des produits ou services au panier, de choisir un client (ou le client comptoir), puis d’encaisser en espèces, Mobile Money, carte ou virement. Le RPC `record_cash_register_sale` crée la facture, enregistre et rapproche le paiement, et décrémente le stock des produits dans une même transaction. Une clé de requête protège contre la création en double en cas de nouvelle tentative; le reçu-facture imprimable est accessible après l’encaissement. Appliquez `supabase/migrations/20261110193000_cash_register_sales.sql` puis exécutez `supabase/tests/cash-register-smoke.sql` sur le projet de test avant tout déploiement en production.

Le module **Relances et recouvrement** repère les factures échues avec un solde restant, prépare un texte modifiable et l’enregistre dans un historique. L’utilisateur peut copier le texte ou ouvrir son application e-mail/WhatsApp, l’envoyer lui-même, puis confirmer le canal utilisé. Ce parcours manuel reste disponible indépendamment du réglage automatique. L’historique identifie séparément les rappels manuels confirmés et les e-mails automatiques, avec leur résultat auprès du prestataire. Les brouillons, factures annulées/payées, avoirs et proformas sont exclus; la base revalide aussi le solde avant la préparation et la confirmation. Appliquez les deux migrations de relance et exécutez le test SQL dans le projet de test avant toute application distincte en production.

Le module **Historique automatisation** filtre les tentatives par date prévue et résultat, expose le détail et l’identifiant de chaque exécution, et permet d’ouvrir la facture générée. Les échéances actives dont la date est passée sans prochaine date planifiée sont signalées. Une échéance sans exécution connue peut être traitée manuellement après confirmation; la base bloque l'action s'il existe déjà une exécution non échouée pour cette échéance. Toute reprise peut créer une facture ou modifier le stock.

Le module **Rapports** applique la période sélectionnée aux métriques et à ses exports. Le CA encaissé correspond aux paiements rapprochés nets (remboursements déduits), selon la date de paiement. L’export comptable filtre les pièces par date d’émission et conserve les dates réelles de leurs règlements associés. Le bénéfice net est une estimation de trésorerie calculée comme les encaissements nets moins les dépenses enregistrées, pas un résultat comptable. La taxe correspond au montant enregistré sur les factures émises pendant la période, hors brouillons et annulations; les taux historiques ne sont pas enregistrés, donc le détail par taux est indisponible. Ce chiffre ne remplace pas une déclaration fiscale.

Le module **Trésorerie et prévisions**, accessible avec les droits Rapports, présente les encaissements attendus, les dépenses estimées et la variation nette cumulée à 30, 60 et 90 jours. Les encaissements sont calculés depuis le solde restant des factures ouvertes après paiements rapprochés ; les retards sont considérés dus immédiatement, tandis que les brouillons, factures payées ou annulées, proformas et avoirs sont exclus. Les dépenses futures sont estimées au prorata des dépenses enregistrées pendant les 90 derniers jours. Les factures sans échéance sont signalées mais non incluses. Cette projection en lecture seule n’est pas un solde bancaire : elle ne connaît ni le solde initial, ni les mouvements bancaires, ni les ventes futures, ni les dépenses planifiées non enregistrées. Sans historique de dépenses, la variation nette est indiquée comme non estimable.

Le module **Fournisseurs et achats** centralise les fournisseurs, les factures d’achat, leurs échéances, les règlements partiels et les soldes restant dus. La facture est séparée de la réception physique : chaque ligne stockable conserve ses quantités facturées, reçues et retournées; seules les quantités réceptionnées augmentent le stock et actualisent le coût moyen pondéré, dans la même transaction que leur mouvement retraçable. Les réceptions partielles peuvent être complétées ensuite, sans dépasser le reliquat facturé. Un retour fournisseur exige une date, un motif et une confirmation récapitulative; il est refusé si la quantité dépasse les marchandises reçues encore disponibles ou si le stock courant est insuffisant. Chaque retour diminue le stock et conserve son historique, mais ne modifie pas automatiquement la dette fournisseur et ne crée pas d’avoir comptable. Les factures non réceptionnées, non retournées et sans aucun historique de paiement peuvent être modifiées avec un récapitulatif; les autres sont verrouillées pour préserver la traçabilité, et doivent être corrigées par inversion des règlements ou annulation. Les propriétaires et administrateurs peuvent sélectionner puis supprimer définitivement des actions de l’historique, avec confirmation; la purge porte sur les actions affichées (50 maximum par opération), sans supprimer les factures, règlements ou mouvements de stock. Une trace technique compacte conserve seulement la date et le nombre d’actions purgées. Les actions e-mail et WhatsApp ouvrent un brouillon prérempli adressé au fournisseur; elles n’envoient rien automatiquement et n’attachent pas les justificatifs. Les lignes libres (charges ou articles non stockés) ne modifient pas l’inventaire. Les paiements d’achat sont suivis séparément des dépenses libres. Lorsqu’une dépense porte le même fournisseur, montant et date qu’un règlement fournisseur actif, les deux formulaires de dépenses affichent un avertissement avant enregistrement; l’utilisateur doit confirmer explicitement s’il s’agit réellement de deux opérations distinctes. Les fiches fournisseurs et factures d’achat acceptent des justificatifs privés PDF/JPEG/PNG/WEBP (10 Mo maximum), accessibles aux membres de l’entreprise par lien signé temporaire; les membres peuvent joindre ceux d’un achat, tandis que seuls propriétaire et administrateurs peuvent joindre ceux d’un fournisseur. L’export CSV du module inclut tous les résultats correspondant aux filtres actifs, même lorsqu’ils couvrent plusieurs pages. La trésorerie affiche les factures fournisseurs échues comme sorties planifiées et ajoute les paiements réellement enregistrés à l’historique des dépenses pour estimer les flux.

La liste des factures affiche aussi des compteurs interactifs par statut (toutes, à payer, partiellement payées, payées et annulées). Ces compteurs sont calculés côté serveur et suivent la recherche, le fournisseur et la période actifs, tout en restant stables quand on sélectionne un statut. Les actions sur une facture (modification, partage, paiement, réception, retour, annulation et détails) sont regroupées au-dessus du tableau : l’utilisateur choisit d’abord l’action, puis recherche et sélectionne la facture cible dans une liste paginée. Les opérations incompatibles avec l’état de la facture ou les droits du rôle sont désactivées avec leur motif; le tableau ne contient plus de commandes répétées sur chaque ligne.

La migration `supabase/migrations/20261110170000_suppliers_and_purchases.sql` a été appliquée au projet Supabase de test `bqjhmmmvmhueqismhjfq`, et son smoke test a réussi. Elle crée les tables et RPC nécessaires sans modifier les lignes métier existantes. Elle n’a pas été appliquée au projet de production `jpxtdwljgdapuvlnmdbz`. Avant son déploiement en production, appliquer la migration séparément après validation.

Les droits du module sont distincts et vérifiés à la fois dans l’interface et en base : tous les rôles peuvent consulter; les membres peuvent créer/modifier les achats admissibles, réceptionner/retourner les marchandises et enregistrer/inverser les paiements; seuls le propriétaire et les administrateurs peuvent gérer le répertoire fournisseurs, annuler une facture d’achat ou purger des actions sélectionnées de l’historique. Une confirmation est requise et la suppression de l’historique ne touche jamais aux opérations financières ou de stock. Une table technique sans accès direct conserve uniquement le nombre et la date de chaque purge. Les opérations sensibles sont inscrites dans l’historique lisible du module, y compris l’ajout, le retrait et les changements de rôle de l’équipe. La création/modification d’une facture d’achat et d’un règlement passe par un récapitulatif explicite avant écriture. Les règlements peuvent être inversés avec date et motif obligatoires; cette action rectifie le solde et les rapports, mais ne déclenche aucun remboursement bancaire. Une facture d’achat ne peut être annulée qu’après inversion de tous ses règlements actifs. L’annulation conserve la facture et son motif, et contre-passe le stock reçu ainsi que le coût moyen des produits concernés. Par prudence, elle est refusée si le stock a changé depuis la dernière réception ou si l’instantané requis manque. Les achats et fournisseurs sont chargés par pages avec filtres côté serveur; les soldes fournisseurs sont agrégés côté serveur. Les migrations `supabase/migrations/20261110230000_purchase_corrections.sql`, `supabase/migrations/20261111001000_purchase_receipts_and_scale.sql`, `supabase/migrations/20261111110000_purchase_supplier_returns.sql`, `supabase/migrations/20261111120000_purchase_permissions_and_activity.sql`, `supabase/migrations/20261111130000_purchase_documents.sql`, `supabase/migrations/20261111140000_edit_unposted_purchase.sql`, `supabase/migrations/20261111141000_fix_purchase_creation_reference.sql`, `supabase/migrations/20261111142000_fix_purchase_receipt_quantity_reference.sql`, `supabase/migrations/20261111150000_delete_purchase_activity_logs.sql` et `supabase/migrations/20261111151000_purchase_status_counts.sql` sont appliquées sur la base de test `bqjhmmmvmhueqismhjfq`; le smoke test fournisseurs/achats passe. Aucune de ces migrations n’a été appliquée à la production `jpxtdwljgdapuvlnmdbz`.

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
