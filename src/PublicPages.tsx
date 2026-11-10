import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Clock3, Mail, Send, ShieldCheck, Users } from 'lucide-react'
import { supabase, supabaseConfigError } from './lib/supabase'
import { appIcon } from './lib/branding'
import { loadMySupportTickets, loadPublicSupportTicket, replyToPublicSupportTicket, submitPublicSupportRequest, loadPublicSubscriptionPlans, loadPublicContent, loadPublicSiteConfig } from './lib/data'
import { defaultPublicSiteConfig } from './lib/publicSiteDefaults'

export function ConfigurationError() {
  return <main className="auth-shell"><div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div><section className="auth-card"><h1>Configuration nécessaire</h1><p className="auth-subtitle">L’application est bien démarrée, mais elle ne peut pas se connecter à Supabase.</p><div className="data-warning">{supabaseConfigError}</div><p className="auth-subtitle">Copiez .env.example vers .env, renseignez les deux valeurs Supabase, puis redémarrez Vite.</p></section></main>
}

export function AuthScreen() {
  const publicRoute = window.location.pathname
  const [showAuth, setShowAuth] = useState(false)
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    let result
    if (mode === 'register') {
      // A previous browser session must not remain active when confirming a new account.
      const signOutResult = await supabase.auth.signOut({ scope: 'local' })
      if (signOutResult.error) {
        setBusy(false)
        setMessage('Impossible de préparer la création du compte. Veuillez réessayer.')
        return
      }
      result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/` } })
    } else if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    }
    setBusy(false)
    if (result.error) {
      setMessage(result.error.message)
    } else if (mode === 'register') {
      setVerificationEmail(email)
      setMessage('')
    } else {
      setMessage(mode === 'login' ? 'Connexion réussie.' : 'Si cette adresse existe, un lien de réinitialisation vient d’être envoyé.')
    }
  }
  const resendVerification = async () => {
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: verificationEmail })
    setMessage(error ? 'Impossible de renvoyer l’e-mail pour le moment.' : 'Un nouvel e-mail de confirmation a été envoyé.')
    setBusy(false)
  }

  if (publicRoute !== '/') return <PublicPage path={publicRoute} onStart={() => { window.history.pushState({}, '', '/'); setMode('register'); setShowAuth(true) }} onLogin={() => { window.history.pushState({}, '', '/'); setMode('login'); setShowAuth(true) }} />
  if (!showAuth) return <LandingPage onStart={() => { setMode('register'); setShowAuth(true) }} onLogin={() => { setMode('login'); setShowAuth(true) }} />
  if (verificationEmail) return <div className="auth-shell"><div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div><div className="auth-card auth-verification-card"><div className="auth-verification-icon"><Mail size={25} /></div><p className="eyebrow">ACTIVATION DU COMPTE</p><h1>Vérifiez votre adresse e-mail.</h1><p className="auth-subtitle">Un lien de confirmation a été envoyé à <strong>{verificationEmail}</strong>. Cliquez sur ce lien pour activer votre compte avant de vous connecter.</p><p className="auth-message">Pensez à vérifier vos courriers indésirables si vous ne trouvez pas l’e-mail.</p><button className="primary-button full-width" disabled={busy} onClick={() => void resendVerification()}>{busy ? 'Envoi en cours...' : 'Renvoyer l’e-mail'}</button>{message && <p className="settings-message success">{message}</p>}<button className="landing-back auth-verification-back" onClick={() => { setVerificationEmail(''); setMode('login'); setMessage('') }}>← Retour à la connexion</button></div><p className="auth-footer">Vos données sont protégées par Supabase et isolées par entreprise.</p></div>

  return (
    <div className="auth-shell">
      <button className="landing-back" onClick={() => setShowAuth(false)}>← Retour à l’accueil</button>
      <div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div>
      <div className="auth-card">
        <p className="eyebrow">{mode === 'login' ? 'ESPACE PROFESSIONNEL' : mode === 'register' ? 'BIENVENUE' : 'SÉCURITÉ'}</p>
        <h1>{mode === 'login' ? 'Connectez-vous à votre espace.' : mode === 'register' ? 'Créez votre compte gratuitement.' : 'Réinitialisez votre mot de passe.'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? 'Retrouvez vos clients, factures et revenus au même endroit.' : mode === 'register' ? 'Commencez à gérer votre activité simplement, depuis n’importe où.' : 'Recevez un lien sécurisé pour choisir un nouveau mot de passe.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Nom complet<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Jean Dossou" /></label>}
          <label>Adresse email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@entreprise.com" /></label>
          {mode !== 'forgot' && <label>Mot de passe<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" /></label>}
          <button className="primary-button full-width" disabled={busy}>{busy ? 'Veuillez patienter...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien'}</button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        {mode === 'login' && <p className="auth-switch"><button onClick={() => { setMode('forgot'); setMessage('') }}>Mot de passe oublié ?</button></p>}
        <p className="auth-switch">{mode === 'login' ? 'Vous n’avez pas encore de compte ?' : 'Vous avez déjà un compte ?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></p>
      </div>
      <p className="auth-footer">Vos données sont protégées par Supabase et isolées par entreprise.</p>
    </div>
  )
}

export function PasswordResetScreen() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8 || password !== confirmation) {
      setMessage(password !== confirmation ? 'Les mots de passe ne correspondent pas.' : 'Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setBusy(true); setMessage('')
    const result = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (result.error) setMessage(result.error.message)
    else { setMessage('Mot de passe mis à jour. Vous pouvez vous connecter.'); await supabase.auth.signOut(); window.history.replaceState({}, '', '/') }
  }
  return <main className="auth-shell"><div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div><section className="auth-card"><p className="eyebrow">SÉCURITÉ</p><h1>Choisissez un nouveau mot de passe.</h1><p className="auth-subtitle">Votre nouveau mot de passe sera utilisé pour sécuriser votre compte.</p><form onSubmit={submit}><label>Nouveau mot de passe<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirmer le mot de passe<input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="primary-button full-width" disabled={busy}>{busy ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}</button></form>{message && <p className="auth-message">{message}</p>}</section></main>
}

export function PublicPage({ path, onStart, onLogin }: { path: string; onStart: () => void; onLogin: () => void }) {
  const contentType = path === '/faq' ? 'faq' : path === '/articles' ? 'article' : path === '/ressources' ? 'resource' : path === '/annonces' ? 'announcement' : null
  const [managedContent, setManagedContent] = useState<Awaited<ReturnType<typeof loadPublicContent>>>([])
  const [siteConfig, setSiteConfig] = useState(defaultPublicSiteConfig)
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [contactMessage, setContactMessage] = useState('')
  const [contactBusy, setContactBusy] = useState(false)
  const [mySupportTickets, setMySupportTickets] = useState<Awaited<ReturnType<typeof loadMySupportTickets>>>([])
  const [supportViewerSignedIn, setSupportViewerSignedIn] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingTicketId, setTrackingTicketId] = useState('')
  const [trackedTicket, setTrackedTicket] = useState<Awaited<ReturnType<typeof loadPublicSupportTicket>> | null>(null)
  const [trackingReply, setTrackingReply] = useState('')
  const [trackingBusy, setTrackingBusy] = useState(false)
  useEffect(() => {
    if (!contentType) return
    void loadPublicContent(contentType).then(setManagedContent).catch(() => setManagedContent([]))
  }, [contentType])
  useEffect(() => { void loadPublicSiteConfig().then((value) => { if (value) setSiteConfig({ ...defaultPublicSiteConfig, ...value }) }).catch(() => undefined) }, [])
  useEffect(() => {
    if (path !== '/contact') return
    void supabase.auth.getUser().then(({ data }) => {
      setSupportViewerSignedIn(Boolean(data.user))
      if (data.user) void loadMySupportTickets().then(setMySupportTickets).catch(() => setMySupportTickets([]))
    })
  }, [path])
  const managedBody = managedContent.length ? <div className="public-copy">{managedContent.map((item) => <article key={item.id}><h2>{item.title}</h2>{item.body.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>)}</div> : null
  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContactBusy(true)
    setContactMessage('')
    try {
      const result = await submitPublicSupportRequest({ name: contactForm.name, email: contactForm.email, subject: contactForm.subject, body: contactForm.message })
      setContactForm({ name: '', email: '', subject: '', message: '' })
      setTrackingTicketId(result.ticket_id)
      setTrackingCode(result.access_code)
      setContactMessage(`Votre demande a été transmise. Conservez votre code de suivi : ${result.access_code}.`)
      if (supportViewerSignedIn) void loadMySupportTickets().then(setMySupportTickets).catch(() => undefined)
    } catch {
      setContactMessage(`La demande n’a pas pu être enregistrée. Vous pouvez écrire directement à ${siteConfig.contactEmail}.`)
    } finally {
      setContactBusy(false)
    }
  }
  const followSupportRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTrackingBusy(true)
    try {
      setTrackedTicket(await loadPublicSupportTicket(trackingTicketId.trim(), trackingCode.trim()))
    } catch {
      setContactMessage('Impossible de retrouver cette demande. Vérifiez l’identifiant et le code de suivi.')
    } finally {
      setTrackingBusy(false)
    }
  }
  const sendTrackingReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTrackingBusy(true)
    try {
      await replyToPublicSupportTicket(trackingTicketId, trackingCode, trackingReply)
      setTrackingReply('')
      setTrackedTicket(await loadPublicSupportTicket(trackingTicketId, trackingCode))
    } catch {
      setContactMessage('Votre réponse n’a pas pu être enregistrée. Vérifiez votre code de suivi.')
    } finally {
      setTrackingBusy(false)
    }
  }
  const content = path === '/faq'
    ? { label: 'AIDE & FAQ', title: 'Tout savoir avant de commencer.', body: managedBody ?? <div className="faq-list"><details open><summary>FactureFacile est-il adapté aux commerces ?</summary><p>Oui. Vous pouvez gérer vos produits, votre stock, vos clients, vos ventes, vos factures et vos paiements depuis un seul espace professionnel.</p></details><details><summary>À qui s’adresse FactureFacile ?</summary><p>La plateforme s’adresse aux commerçants, indépendants, artisans, professions de services, PME et équipes qui souhaitent centraliser leur gestion quotidienne.</p></details><details><summary>Comment créer mon compte ?</summary><p>Cliquez sur « Créer mon compte », renseignez votre adresse e-mail et choisissez un mot de passe. Un e-mail de confirmation vous sera envoyé. Vous devrez cliquer sur le lien reçu avant votre première connexion.</p></details><details><summary>Puis-je créer des factures en FCFA ?</summary><p>Oui, la devise FCFA est prise en charge pour vos factures, vos paiements et votre suivi financier. Vous pouvez renseigner vos clients, vos produits, vos services, les taxes et les dates d’échéance.</p></details><details><summary>Quels types de documents puis-je gérer ?</summary><p>Selon votre espace et votre plan, vous pouvez préparer des factures standards, proforma, d’acompte, d’avoir et définitives. Vérifiez toujours les mentions et informations requises avant l’envoi à votre client.</p></details><details><summary>Puis-je suivre les paiements et les impayés ?</summary><p>Oui. Enregistrez les règlements associés à vos factures et consultez les montants payés, restants ou en retard depuis votre tableau de bord et vos rapports.</p></details><details><summary>La plateforme gère-t-elle les stocks ?</summary><p>Oui. Vous pouvez enregistrer vos produits, leurs prix, leurs unités et leurs quantités, puis surveiller les niveaux faibles afin de mieux préparer vos réapprovisionnements.</p></details><details><summary>Peut-on travailler en équipe ?</summary><p>Oui, les plans adaptés permettent d’inviter des membres et de leur attribuer un rôle. Les permissions limitent l’accès aux opérations selon les responsabilités de chacun.</p></details><details><summary>Quels sont les plans disponibles ?</summary><p>Les plans actifs, leurs types, leurs prix, leurs limites d’utilisateurs et de factures sont affichés dans la section Tarifs de l’espace public. Les fonctionnalités peuvent évoluer selon la formule choisie.</p></details><details><summary>Mes données sont-elles protégées ?</summary><p>Chaque entreprise dispose d’un espace isolé et sécurisé, avec une gestion des accès adaptée à son équipe. Ne partagez jamais vos identifiants et signalez rapidement toute activité inhabituelle.</p></details><details><summary>Comment demander de l’aide ?</summary><p>Consultez cette FAQ ou contactez notre équipe à contact@facturefacile.bj en indiquant le nom de votre entreprise, l’adresse e-mail du compte et une description précise de votre demande.</p></details></div> }
    : contentType ? { label: contentType === 'article' ? 'ARTICLES' : contentType === 'resource' ? 'RESSOURCES' : 'ANNONCES', title: contentType === 'article' ? 'Articles FactureFacile' : contentType === 'resource' ? 'Ressources utiles' : 'Annonces FactureFacile', body: managedBody ?? <div className="public-copy"><p>Aucun contenu publié pour le moment.</p></div> }
    : path === '/mentions-legales'
        ? { label: 'LÉGAL', title: 'Mentions légales', body: <div className="public-copy"><p><strong>Conformément aux lois en vigueur au Bénin · Dernière mise à jour : 08/09/2026</strong></p><h2>1. Éditeur de la plateforme</h2><p><strong>FactureFacile Bénin</strong></p><p>Forme juridique : plateforme numérique de gestion professionnelle opérée par l’équipe FactureFacile Bénin.<br />Adresse du siège : Cotonou, République du Bénin.<br />Téléphone : +229 97 00 00 00.<br />E-mail : <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a><br />Directeur de la publication : équipe FactureFacile Bénin.</p><p>FactureFacile est une plateforme numérique de gestion destinée aux artisans, commerçants, indépendants, PME et entreprises de services.</p><h2>2. Hébergement</h2><p>La plateforme FactureFacile est déployée sur une infrastructure cloud sécurisée, avec <strong>Vercel</strong> pour la diffusion de l’application et <strong>Supabase</strong> pour l’authentification, la base de données et le stockage.</p><p>Les prestataires techniques sont choisis selon des critères de sécurité, disponibilité et conformité applicables. Le contrat d’hébergement précise les responsabilités de chacun et les mesures de continuité de service.</p><h2>3. Propriété intellectuelle</h2><p>L’ensemble des contenus présents sur FactureFacile — textes, graphismes, logo, icônes, images, interfaces et composants logiciels — appartient à FactureFacile ou à ses partenaires et est protégé par les règles applicables en matière de propriété intellectuelle. Toute reproduction, représentation, modification, publication, extraction ou adaptation totale ou partielle est interdite sans autorisation écrite préalable.</p><h2>4. Données personnelles</h2><p>FactureFacile collecte et traite des données personnelles dans le cadre de la fourniture de ses services. Ces traitements sont décrits dans notre <a href="/confidentialite">Politique de confidentialité</a>. Vous pouvez demander l’accès, la rectification, la portabilité ou la suppression de vos données en contactant <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. Une vérification d’identité peut être demandée.</p><h2>5. Cookies et technologies nécessaires</h2><p>FactureFacile utilise les mécanismes strictement nécessaires au fonctionnement de la plateforme, notamment la session d’authentification, la sécurité et la conservation des préférences. Aucun cookie publicitaire ou dispositif de suivi tiers n’est volontairement utilisé dans l’espace public. Vous pouvez configurer votre navigateur pour limiter les cookies techniques, mais cela peut empêcher la connexion ou certaines fonctions.</p><h2>6. Limitation de responsabilité</h2><p>FactureFacile fournit des outils de gestion, de facturation et de suivi ; la plateforme ne se substitue pas à un conseil comptable, fiscal ou juridique. L’utilisateur reste responsable de l’exactitude de ses données, de ses factures, de ses obligations légales et des accès accordés à son équipe. FactureFacile ne peut être tenu responsable des erreurs de saisie, des décisions prises à partir des données affichées, des interruptions réseau ou des événements indépendants de sa volonté.</p><h2>7. Disponibilité et maintenance</h2><p>Nous mettons en œuvre des moyens raisonnables pour assurer la disponibilité, la sécurité et la continuité du service. Des interruptions peuvent toutefois survenir en raison d’une maintenance, d’une mise à jour, d’un incident technique, d’une panne d’un prestataire ou d’un événement de force majeure.</p><h2>8. Droit applicable et règlement des différends</h2><p>Les présentes mentions légales sont soumises au droit béninois. En cas de difficulté relative à leur interprétation ou à leur exécution, les parties recherchent d’abord une solution amiable. À défaut, les juridictions compétentes au Bénin pourront être saisies, sous réserve des dispositions légales impératives applicables.</p><h2>9. Contact</h2><p>Pour toute question relative aux présentes mentions légales :</p><p>📧 E-mail : <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a><br />📞 Téléphone : +229 97 00 00 00<br />📍 Adresse : Cotonou, République du Bénin</p></div> }
    : path === '/confidentialite'
        ? { label: 'INFORMATIONS LÉGALES', title: 'Politique de confidentialité', body: <div className="public-copy"><p>{siteConfig.legalPrivacy}</p><h2>1. Données collectées</h2><p>Nous pouvons collecter les informations nécessaires à la création du compte, à l’identification de l’utilisateur, à la gestion de l’entreprise, à la facturation et au support : nom, e-mail, téléphone, informations de l’entreprise, clients, produits, factures et paiements saisis dans l’espace professionnel.</p><h2>2. Finalités</h2><p>Ces données servent à fournir les fonctionnalités demandées, sécuriser les comptes, traiter les opérations, assurer le support, améliorer le service et envoyer les communications indispensables à son fonctionnement. Elles ne sont pas vendues à des tiers.</p><h2>3. Accès et séparation des espaces</h2><p>Les données commerciales restent privées et sont isolées par entreprise. Les droits d’accès dépendent du rôle attribué à chaque membre. Chaque utilisateur doit protéger ses identifiants et signaler immédiatement toute utilisation suspecte de son compte.</p><h2>4. Prestataires techniques</h2><p>Des prestataires spécialisés peuvent traiter certaines données pour l’hébergement, l’authentification, le stockage, l’envoi d’e-mails ou le paiement. Ils sont utilisés uniquement pour les besoins du service et selon les garanties applicables.</p><h2>5. Conservation et suppression</h2><p>Les données sont conservées pendant la durée nécessaire à la fourniture du service, au respect des obligations légales et au traitement des litiges. Une demande de suppression peut entraîner la fermeture de l’espace et la perte des données qui ne doivent pas être conservées légalement.</p><h2>6. Vos droits</h2><p>Vous pouvez demander l’accès, la correction, la portabilité ou la suppression de vos données, ainsi que la limitation de certains traitements, en contactant notre équipe à <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. Une vérification d’identité peut être demandée avant toute action.</p><h2>7. Cookies et sécurité</h2><p>Le service utilise les mécanismes nécessaires à l’authentification, à la sécurité et au maintien de la session. Nous appliquons des contrôles d’accès et des mesures techniques raisonnables, sans pouvoir garantir un risque nul sur Internet.</p></div> }
      : path === '/conditions'
          ? { label: 'LÉGAL', title: 'Conditions Générales d’Utilisation', body: <div className="public-copy"><p><strong>Dernière mise à jour : 08/09/2026 · En vigueur au Bénin 🇧🇯</strong></p><p>Les présentes Conditions Générales d’Utilisation (CGU) encadrent l’accès et l’utilisation de FactureFacile. En créant un compte ou en utilisant la plateforme, vous reconnaissez avoir lu, compris et accepté ces conditions.</p><h2>1. Présentation de FactureFacile</h2><p>FactureFacile est une plateforme numérique de gestion destinée aux artisans, commerçants, indépendants, PME et entreprises de services au Bénin. Elle permet notamment de gérer les clients, produits, services, stocks, ventes, factures, paiements, dépenses, rapports et membres d’équipe depuis un espace professionnel.</p><h2>2. Acceptation des CGU</h2><p>L’utilisation de FactureFacile implique l’acceptation pleine et entière des présentes conditions. Si vous n’acceptez pas ces conditions, vous ne devez pas utiliser la plateforme. FactureFacile peut modifier les CGU pour tenir compte de l’évolution du service, de la réglementation ou de la sécurité. Les changements importants seront signalés par un moyen approprié, notamment par e-mail ou dans l’application.</p><h2>3. Création et sécurité du compte</h2><p>L’utilisateur doit fournir des informations exactes, maintenir son adresse e-mail à jour et confirmer son compte lorsque cela est demandé. Il doit protéger ses identifiants, ne pas les partager et signaler rapidement toute connexion suspecte. Le titulaire du compte est responsable des actions réalisées depuis son espace.</p><h2>4. Utilisation du service</h2><p>FactureFacile doit être utilisé pour des besoins professionnels licites. Il est interdit de contourner les contrôles de sécurité, d’accéder aux données d’une autre entreprise, d’introduire un contenu malveillant, de perturber la plateforme ou d’utiliser le service pour une activité frauduleuse ou illégale.</p><h2>5. Données, factures et obligations de l’utilisateur</h2><p>L’utilisateur reste responsable des informations saisies, de ses clients, produits, prix, taxes, dates, paiements et documents. Il doit vérifier les calculs, la numérotation, les destinataires et la conformité de ses factures avec les règles applicables au Bénin. FactureFacile fournit un outil de gestion et ne remplace pas un conseil comptable, fiscal ou juridique.</p><h2>6. Plans, fonctionnalités et limites</h2><p>Les fonctionnalités, limites d’utilisateurs, volumes de factures et options disponibles dépendent du plan affiché dans l’espace public ou dans l’espace de l’entreprise. Les plans peuvent être de type Free, Basic, Pro ou Business selon la configuration publiée. Une évolution de plan peut modifier les limites applicables sans supprimer les obligations de l’utilisateur relatives aux données déjà créées.</p><h2>7. Tarifs et paiements</h2><p>Les prix, la devise, la périodicité et les fonctionnalités incluses sont présentés avant toute souscription. Les paiements peuvent être traités par un prestataire de paiement autorisé, selon ses propres conditions. Tout montant dû doit être réglé dans les délais indiqués. En cas d’échec ou de non-paiement, certaines fonctionnalités peuvent être limitées après information de l’utilisateur.</p><h2>8. Disponibilité, maintenance et sauvegardes</h2><p>Nous faisons notre possible pour maintenir FactureFacile disponible, fiable et sécurisé. Des interruptions peuvent survenir pour maintenance, mise à jour, incident technique, coupure réseau ou événement indépendant de notre volonté. L’utilisateur doit conserver les documents importants dans ses propres procédures et ne pas considérer la plateforme comme son unique moyen d’archivage.</p><h2>9. Propriété intellectuelle et licence</h2><p>La marque, le code, l’interface, les textes, les éléments graphiques et les fonctionnalités de FactureFacile restent protégés par les règles applicables de propriété intellectuelle. Une licence limitée, personnelle, non exclusive et non transférable est accordée pendant la durée de l’accès au service. Toute copie, extraction, revente ou adaptation non autorisée est interdite.</p><h2>10. Responsabilité</h2><p>FactureFacile ne peut être tenu responsable des erreurs provenant des données saisies par l’utilisateur, de l’usage inadapté des documents, d’une interruption du réseau ou d’un événement hors de son contrôle. L’utilisateur demeure responsable de ses obligations commerciales, comptables, fiscales et légales, ainsi que des accès accordés aux membres de son équipe.</p><h2>11. Suspension et résiliation</h2><p>L’accès peut être limité, suspendu ou résilié en cas de risque de sécurité, d’utilisation interdite, de fraude, de violation des présentes conditions ou de non-paiement. L’utilisateur peut demander la fermeture de son compte en contactant le support. La suppression d’un compte peut rendre les données et documents associés indisponibles ; l’utilisateur doit donc effectuer ses exports avant la clôture.</p><h2>12. Données personnelles</h2><p>Le traitement des données personnelles est décrit dans la <a href="/confidentialite">Politique de confidentialité</a>. Les utilisateurs doivent également s’assurer qu’ils disposent d’une base légitime pour saisir et traiter les données de leurs propres clients.</p><h2>13. Droit applicable et règlement des différends</h2><p>Les présentes CGU sont interprétées conformément aux règles applicables au Bénin. En cas de difficulté, les parties recherchent d’abord une solution amiable en contactant le support avant toute démarche contentieuse.</p><h2>14. Contact</h2><p>Pour toute question sur ces conditions, contactez <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a> en indiquant le nom de votre entreprise et l’adresse e-mail du compte.</p></div> }
        : { label: 'AIDE', title: 'Comment pouvons-nous vous aider ?', body: <div className="public-copy contact-page-content"><p className="contact-intro">Notre équipe répond sous 24h ouvrées.</p><section className="contact-form-section tracking-section"><p className="eyebrow">SUIVRE MA RÉPONSE</p><h2>Retrouvez votre demande</h2><p>Après l’envoi, conservez l’identifiant et le code de suivi reçus. Aucun compte n’est nécessaire.</p><form className="contact-form tracking-form" onSubmit={followSupportRequest}><label>Identifiant de la demande<input required value={trackingTicketId} onChange={(event) => setTrackingTicketId(event.target.value)} /></label><label>Code de suivi<input required value={trackingCode} onChange={(event) => setTrackingCode(event.target.value.toUpperCase())} /></label><button className="primary-button" type="submit" disabled={trackingBusy}>{trackingBusy ? 'Recherche...' : 'Suivre ma réponse'}</button></form>{trackedTicket && <article className="support-conversation tracked-ticket"><strong>{trackedTicket.subject}</strong>{trackedTicket.messages.map((message) => <div className={`support-message ${message.author_role === 'support' ? 'from-support' : ''}`} key={message.id}><small>{message.author_role === 'support' ? 'Équipe FactureFacile' : 'Vous'} · {new Date(message.created_at).toLocaleString('fr-FR')}</small><p>{message.body}</p></div>)}<form className="contact-form tracking-reply-form" onSubmit={sendTrackingReply}><label>Poser une autre question<textarea required rows={4} value={trackingReply} onChange={(event) => setTrackingReply(event.target.value)} /></label><button className="primary-button" type="submit" disabled={trackingBusy}>Envoyer la réponse</button></form></article>}</section>{supportViewerSignedIn && <section className="contact-faq"><p className="eyebrow">MES DEMANDES</p><h2>Réponses de l’équipe</h2>{mySupportTickets.length ? <div className="support-conversations">{mySupportTickets.map((ticket) => <article className="support-conversation" key={ticket.id}><div><strong>{ticket.subject}</strong><span className={`support-status ${ticket.status}`}>{ticket.status === 'resolved' ? 'Résolu' : ticket.status === 'in_progress' ? 'En cours' : 'Ouvert'}</span></div>{ticket.messages.map((message) => <div className={`support-message ${message.author_role === 'support' ? 'from-support' : ''}`} key={message.id}><small>{message.author_role === 'support' ? 'Équipe FactureFacile' : 'Vous'} · {new Date(message.created_at).toLocaleString('fr-FR')}</small><p>{message.body}</p></div>)}</article>)}</div> : <p>Aucune demande enregistrée pour le moment.</p>}</section>}<div className="contact-channel-grid"><article><span className="contact-channel-icon">📧</span><h2>Email</h2><p>Pour les questions générales et les demandes de support.</p><a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a><small>Réponse sous 24h ouvrées</small></article><article><span className="contact-channel-icon">💬</span><h2>WhatsApp</h2><p>Pour les urgences et les problèmes de paiement.</p><a className="contact-link" href="https://wa.me/22997000000" target="_blank" rel="noreferrer">+229 97 00 00 00</a><small>Lun–Ven, 8h–18h</small></article><article><span className="contact-channel-icon">⚖️</span><h2>Litige</h2><p>Pour signaler un problème lié à une facture ou à votre espace.</p><button className="outline-button" type="button" onClick={onLogin}>Se connecter d’abord</button><small>Traitement sous 48h ouvrées</small></article></div>        <section className="contact-form-section"><p className="eyebrow">NOUS ÉCRIRE</p><h2>Décrivez votre besoin</h2>{!supportViewerSignedIn && <p className="contact-auth-hint">Connectez-vous pour envoyer une demande et suivre la réponse des administrateurs dans « Mes demandes ».</p>}<form className="contact-form" onSubmit={submitContact}><label>Votre nom<input required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} /></label><label>Votre e-mail<input required type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></label><label>Sujet<select required value={contactForm.subject} onChange={(event) => setContactForm({ ...contactForm, subject: event.target.value })}><option value="">Choisir un sujet</option><option>Question générale</option><option>Problème de connexion</option><option>Paiement ou abonnement</option><option>Question sur une facture</option><option>Signaler un problème</option><option>Autre demande</option></select></label><label>Votre message<textarea required rows={5} value={contactForm.message} onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })} /></label>        <button className="primary-button" type="submit" disabled={contactBusy}>{contactBusy ? 'Transmission...' : 'Envoyer la demande'} <Send size={15} /></button>{contactMessage && <p className="settings-message success">{contactMessage}</p>}</form></section><section className="contact-faq"><p className="eyebrow">QUESTIONS FRÉQUENTES</p><div className="faq-list"><details><summary>Quel est le délai de réponse ?</summary><p>Notre équipe répond généralement sous 24 heures ouvrées. Les demandes de litige peuvent nécessiter jusqu’à 48 heures ouvrées.</p></details><details><summary>Que dois-je indiquer dans ma demande ?</summary><p>Indiquez votre nom, l’e-mail du compte, le nom de votre entreprise et une description précise du problème. Ne transmettez jamais votre mot de passe.</p></details><details><summary>Comment signaler un paiement ou un abonnement ?</summary><p>Utilisez le formulaire avec le sujet « Paiement ou abonnement » ou contactez-nous sur WhatsApp pendant les horaires d’assistance.</p></details><details><summary>Comment demander la suppression de mes données ?</summary><p>Écrivez à notre adresse de support depuis l’e-mail associé au compte. Une vérification d’identité pourra être demandée.</p></details></div></section></div> }
  return <main className="public-page"><nav className="landing-nav"><a className="auth-brand public-brand" href="/"><img className="brand-mark" alt="FactureFacile" src={appIcon} /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></a><div className="landing-nav-actions"><button className="outline-button" onClick={onLogin}>Se connecter</button><button className="primary-button" onClick={onStart}>Créer mon compte</button></div></nav><article className="public-card"><p className="eyebrow">{content.label}</p><h1>{content.title}</h1>{content.body}</article><footer className="landing-footer public-footer"><div><strong>FactureFacile <span>BÉNIN</span></strong></div><nav className="compact-public-links"><a href="/faq">FAQ</a><a href="/contact">Contact</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a><a href="/conditions">Conditions</a></nav><small>© 2026 FactureFacile Bénin.</small></footer></main>
}

export function LandingPage({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const defaultFeatures = [
    ['Vendez et facturez simplement', 'Pour les boutiques, commerces et entreprises de services, créez des factures professionnelles en quelques clics.'],
    ['Suivez votre activité', 'Visualisez vos ventes, revenus, paiements, dépenses et stocks au même endroit.'],
    ['Développez votre entreprise', 'Gagnez du temps avec une gestion claire, sécurisée et adaptée aux entreprises béninoises.'],
  ]
  const [publicFeatures, setPublicFeatures] = useState(defaultFeatures)
  const [publicPlans, setPublicPlans] = useState<Awaited<ReturnType<typeof loadPublicSubscriptionPlans>>>([])
  const [siteConfig, setSiteConfig] = useState(defaultPublicSiteConfig)
  const publicContactHref = `mailto:${siteConfig.contactEmail}`
  useEffect(() => {
    void loadPublicContent('feature').then((items) => {
      if (items.length) setPublicFeatures(items.map((item) => [item.title, item.body] as [string, string]))
    }).catch(() => undefined)
    void loadPublicSubscriptionPlans().then(setPublicPlans).catch(() => undefined)
    void loadPublicSiteConfig().then((value) => { if (value) setSiteConfig({ ...defaultPublicSiteConfig, ...value }) }).catch(() => undefined)
  }, [])
  const steps = siteConfig.steps
  const proofStats = [
    { value: '3 500+', label: 'entreprises actives' },
    { value: '98%', label: 'satisfaction client' },
    { value: '10 min', label: 'pour démarrer' },
    { value: '24/7', label: 'accès sécurisé' },
  ]
  const localBenefits = [
    { icon: <ShieldCheck size={18} />, title: 'Paiements sécurisés', body: 'Transactions fiables en FCFA avec une gestion souple pour votre activité.' },
    { icon: <Users size={18} />, title: 'Suivi simple', body: 'Clients, produits, factures et relances restent centralisés dans un seul espace.' },
    { icon: <Clock3 size={18} />, title: 'Gain de temps réel', body: 'Automatisez les relances et réduisez les erreurs de gestion manuelle.' },
  ]
  const landingFaqs = [
    ['Puis-je commencer sans tout configurer ?', 'Oui. La création de compte est rapide, et vous pouvez commencer par les informations essentielles de votre entreprise, vos clients et vos premiers produits ou services.'],
    ['Le système est-il adapté au Bénin ?', 'Oui. L’interface est conçue pour les activités locales avec factures en FCFA, suivi de paiements et gestion de base commerciale adaptée au quotidien des petites et moyennes entreprises.'],
    ['Puis-je gérer les paiements et les relances ?', 'Oui. Vous pouvez suivre vos factures, enregistrer les paiements, identifier les relances et garder un historique clair de votre activité.'],
    ['Que se passe-t-il si j’ai besoin d’aide ?', 'Vous pouvez ouvrir un ticket depuis l’interface ou contacter directement l’équipe par e-mail ou WhatsApp pour obtenir une réponse rapide.'],
  ]
  const pricingHighlight = publicPlans.find((plan) => plan.code === 'pro') ?? publicPlans[0] ?? null
  return <main className="landing-page">
    <nav className="landing-nav"><a className="auth-brand public-brand" href="/"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></a><div className="landing-nav-links">{siteConfig.navLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div><div className="landing-nav-actions"><button className="outline-button" onClick={onLogin}>Se connecter</button><button className="primary-button" onClick={onStart}>Créer un compte</button></div></nav>
    <section className="landing-hero"><div className="landing-copy"><p className="eyebrow">{siteConfig.heroEyebrow}</p><div className="audience-tags">{siteConfig.audienceTags.map((tag) => <span key={tag}>{tag}</span>)}</div><h1>{siteConfig.heroTitle}<br /><span>{siteConfig.heroTitleAccent}</span></h1><p className="landing-subtitle">{siteConfig.heroSubtitle}</p><div className="landing-trust"><ShieldCheck size={17} /><span>{siteConfig.heroTrust}</span></div><div className="landing-actions hero-actions"><button className="primary-button" onClick={onStart}>Démarrer gratuitement <ArrowRight size={16} /></button><button className="outline-button landing-login-button" onClick={onLogin}>J’ai déjà un compte</button></div></div><div className="landing-preview" aria-label="Aperçu du tableau de bord"><div className="preview-top"><span>FactureFacile</span><span className="preview-dot" /></div><div className="preview-welcome">Tableau de bord <small>Suivi de votre activité</small></div><div className="preview-stats"><div><small>Encaissements</small><strong>2 845 000</strong><em>FCFA</em></div><div><small>Factures</small><strong>48</strong><em>ce mois</em></div></div><div className="preview-chart"><span /><i /><b /><em /><strong /></div><div className="preview-invoice"><div><strong>Dernière facture</strong><small>FAC-00124</small></div><b>Payée</b></div></div></section>
    <section className="landing-proof-bar" aria-label="Preuves de confiance">{proofStats.map((stat) => <div className="proof-stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</section>
    <section className="landing-features" id="fonctionnalites">{publicFeatures.map(([title, description], index) => <article key={`${title}-${index}`}><span>0{index + 1}</span><h2>{title}</h2><p>{description}</p></article>)}</section>
    <section className="landing-solutions" id="solutions"><div className="landing-section-heading"><p className="eyebrow">UNE SOLUTION POUR CHAQUE ACTIVITÉ</p><h2>{siteConfig.solutionsTitle}</h2><p>{siteConfig.solutionsSubtitle}</p></div><div className="solution-grid">{siteConfig.solutions.map(({ title, body }) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="landing-local-value"><div className="landing-section-heading"><p className="eyebrow">UNE VALEUR CONCRÈTE</p><h2>Conçu pour les entreprises qui veulent aller vite, sans perdre en qualité.</h2></div><div className="value-grid">{localBenefits.map((benefit) => <article className="value-card" key={benefit.title}><span className="value-icon">{benefit.icon}</span><h3>{benefit.title}</h3><p>{benefit.body}</p></article>)}</div></section>
    <section className="landing-problems"><div><p className="eyebrow">FINI LES INFORMATIONS DISPERSÉES</p><h2>Une seule plateforme pour rester organisé.</h2></div><p>Excel pour les calculs, Word pour les factures, WhatsApp pour les envoyer et un cahier pour les paiements : cette organisation fait perdre du temps et crée des erreurs. FactureFacile centralise votre activité dans un espace clair et sécurisé.</p></section>
    <section className="landing-social-proof"><div className="landing-section-heading"><p className="eyebrow">PREUVE SOCIALE</p><h2>Des entrepreneurs qui gagnent du temps et plus de sérénité.</h2></div><div className="proof-grid"><article className="proof-card"><p>« On a réduit le temps de suivi des clients et des paiements de moitié. Les factures sont envoyées sans friction et les relances sont plus simples. »</p><div><strong>Élodie H.</strong><span>Commerce · Cotonou</span></div></article><article className="proof-card"><p>« J’ai enfin un aperçu clair de ma trésorerie. Les stocks et les paiements sont suivis au même endroit, ce qui évite les oublis. »</p><div><strong>Hermann A.</strong><span>Entreprise de services · Porto-Novo</span></div></article><article className="proof-card"><p>« L’espace est simple, rapide et adapté à notre réalité locale. On peut gérer nos factures sans dépendre de plusieurs outils. »</p><div><strong>Patricia S.</strong><span>PME · Parakou</span></div></article></div></section>
    <section className="landing-product">
      <div className="landing-section-heading"><p className="eyebrow">UNE VUE CLAIRE DE VOTRE ACTIVITÉ</p><h2>Les outils essentiels de votre entreprise, au même endroit.</h2><p>Un aperçu de l’espace de travail que vous retrouverez après votre inscription.</p></div>
      <div className="product-showcase">
        <div className="product-sidebar"><strong>Facture<span>Facile</span></strong><span className="product-sidebar-active">Tableau de bord</span><span>Clients</span><span>Produits & services</span><span>Factures</span><span>Paiements</span><span>Rapports</span></div>
        <div className="product-screen"><div className="product-screen-top"><span>Tableau de bord</span><b>Votre activité en un coup d’œil</b></div><div className="product-screen-stats"><div><small>CA encaissé</small><strong>2 845 000 <em>FCFA</em></strong><span>+12,5% ce mois</span></div><div><small>Factures</small><strong>48</strong><span>24 payées</span></div><div><small>Clients</small><strong>36</strong><span>+4 ce mois</span></div></div><div className="product-screen-grid"><div className="product-chart"><b>Évolution du chiffre d’affaires</b><div><i /><i /><i /><i /><i /><i /></div></div><div className="product-invoices"><b>Dernières factures</b><p><span>FAC-00124</span><strong>Payée</strong></p><p><span>FAC-00123</span><strong>En attente</strong></p><p><span>FAC-00122</span><strong>Payée</strong></p></div></div></div>
      </div>
    </section>
    <section className="landing-how">
      <div className="landing-section-heading">
        <p className="eyebrow">SIMPLE DÈS LE PREMIER JOUR</p>
        <h2>Une gestion claire, en trois étapes.</h2>
        <p>Tout ce dont vous avez besoin pour gérer votre activité sans complexité inutile.</p>
      </div>
      <div className="landing-steps">{steps.map(({ number, title, body }) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
    </section>
    <section className="landing-trust-panel">
      <ShieldCheck size={25} />
      <div><strong>Une solution pensée pour votre quotidien</strong><p>Factures en FCFA, suivi des stocks et données protégées pour les commerces et entreprises du Bénin.</p></div>
      <button className="outline-button" onClick={onStart}>Créer mon compte</button>
    </section>
    <section className="landing-testimonial">
      <p className="eyebrow">ILS GÈRENT LEUR ACTIVITÉ AVEC SÉRÉNITÉ</p>
      <blockquote>« Je retrouve mes ventes, mes clients et mes paiements au même endroit. Je gagne du temps chaque semaine. »</blockquote>
      <div><strong>Akouavi Dossou</strong><span> — Gérante de commerce, Cotonou</span></div>
    </section>
    <section className="landing-faq"><div className="landing-section-heading"><p className="eyebrow">FAQ</p><h2>Les réponses aux questions que vous vous posez.</h2></div><div className="faq-list">{landingFaqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="landing-contact" id="contact">
      <div className="landing-section-heading"><p className="eyebrow">CONTACT</p><h2>Un accompagnement rapide pour votre activité.</h2></div>
      <div className="contact-grid">
        <article className="contact-card">
          <span className="contact-icon"><Mail size={18} /></span>
          <h3>Écrivez-nous</h3>
          <p>Besoin d’un conseil pour choisir la bonne formule ou avancer sur votre configuration ?</p>
          <a href={publicContactHref}>{siteConfig.contactEmail}</a>
        </article>
        <article className="contact-card">
          <span className="contact-icon"><Send size={18} /></span>
          <h3>WhatsApp</h3>
          <p>Pour un échange rapide sur votre compte, vos factures ou votre setup de gestion.</p>
          <a href="https://wa.me/22997000000" target="_blank" rel="noreferrer">+229 97 00 00 00</a>
        </article>
      </div>
    </section>
    <section className="landing-pricing" id="tarifs">
      <div className="landing-section-heading"><p className="eyebrow">UNE TARIFICATION SIMPLE</p><h2>Commencez sans engagement.</h2><p>Accédez à l’essentiel pour organiser votre entreprise, sans surprise.</p></div>
      {publicPlans.length ? publicPlans.map((plan) => <article className={`pricing-card ${pricingHighlight?.id === plan.id ? 'pricing-featured' : ''}`} key={plan.id}><div><span className="pricing-label">FORMULE {plan.code.toUpperCase()}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="pricing-meta"><span>{plan.billing_period === 'yearly' ? 'Facturation annuelle' : 'Facturation mensuelle'}</span><span>{plan.limits.users ?? 1} utilisateur{(plan.limits.users ?? 1) > 1 ? 's' : ''}</span><span>{plan.limits.invoices ?? 0} factures / mois</span></div><ul>{plan.features.slice(0, 4).map((feature) => <li key={feature}>{feature}</li>)}</ul></div><strong>{plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} ${plan.currency}`}<small>{plan.price === 0 ? ' pour commencer' : plan.billing_period === 'yearly' ? ' / an' : ' / mois'}</small></strong><button className="primary-button" onClick={onStart}>{pricingHighlight?.id === plan.id ? 'Choisir la formule pro' : 'Choisir ce plan'} <ArrowRight size={15} /></button></article>) : <div className="pricing-card pricing-featured"><div><span className="pricing-label">ESSENTIEL</span><h3>Gestion professionnelle</h3><p>Tout pour démarrer et suivre votre activité.</p></div><strong>Gratuit<small> pour commencer</small></strong></div>}
    </section>
    <section className="landing-final-cta"><h2>{siteConfig.finalCtaTitle}</h2><p>{siteConfig.finalCtaBody}</p><div className="landing-actions"><button className="primary-button" onClick={onStart}>Créer mon compte gratuitement <ArrowRight size={16} /></button><button className="outline-button landing-login-button" onClick={onLogin}>J’ai déjà un compte</button></div></section>
    <footer className="landing-footer"><div><strong>FactureFacile <span>BÉNIN</span></strong></div><nav className="compact-public-links"><a href="#fonctionnalites">Fonctionnalités</a><a href="#solutions">Solutions</a><a href="#tarifs">Tarifs</a><a href="/faq">FAQ</a><a href="/contact">Contact</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a><a href="/conditions">Conditions</a></nav><small>© 2026 FactureFacile Bénin.</small></footer>
  </main>
}
