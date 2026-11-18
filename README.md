# labordure

# --- SCHEMAS ---

Create table managers:
  id: uuid pk
  nom: text unique not null
  sponsor: text
  email: text unique
  role: enum('manager','admin') default 'manager'
  created_at: timestamp default now()

Create table coureurs:
  id: text pk            # depuis CSV "Coureurs_rows.csv"
  nom: text not null
  equipe: text
  prix_initial: decimal(10,2) not null
  uci_id: text
  index (nom), index (equipe)

Create table saisons:
  id: uuid pk
  annee: int not null unique
  created_at: timestamp default now()

Create table phases:
  id: uuid pk
  saison_id: uuid fk -> saisons.id
  index_dans_saison: int not null        # 1..5
  date_debut: date not null
  date_fin: date not null
  budget: decimal(10,2) default 2200.00
  max_coureurs: int default 30
  statut: enum('draft','auction_open','auction_closed','active','completed') default 'draft'
  check(date_fin >= date_debut)

Create table courses:
  id: text pk            # depuis CSV "Courses_rows.csv"
  nom: text not null
  categorie: text not null               # "Race Category"
  type_course: text                      # "Race Type"
  date_debut: date
  date_fin: date
  phase_id: uuid fk -> phases.id
  statut: enum('scheduled','completed') default 'scheduled'
  uci_code: text
  index (categorie), index (date_debut)

Create table scoring_rules:
  id: text pk            # depuis CSV "Baremes_rows.csv"
  categorie: text not null
  type_classement: enum('Etape','General','Points','Montagne','Jeune') not null
  place: int not null    # 1,2,3,...
  points: int not null
  type: text
  unique(categorie, type_classement, place)

Create table auctions:
  id: uuid pk
  phase_id: uuid fk -> phases.id
  round_number: int not null
  deadline_at: timestamp not null
  statut: enum('open','closed') default 'open'
  created_at: timestamp default now()
  closed_at: timestamp
  unique(phase_id, round_number)

Create table bids:
  id: uuid pk
  auction_id: uuid fk -> auctions.id
  round_number: int not null
  manager_id: uuid fk -> managers.id
  coureur_id: text fk -> coureurs.id
  montant: decimal(10,2) not null
  statut: enum('pending','won','lost','invalid','carried_over') default 'pending'
  unique(auction_id, round_number, manager_id, coureur_id)
  check(montant >= 0)

Create table rosters:
  id: uuid pk
  phase_id: uuid fk -> phases.id
  manager_id: uuid fk -> managers.id
  coureur_id: text fk -> coureurs.id
  prix_signature: decimal(10,2) not null
  unique(phase_id, coureur_id)   # un coureur = un seul manager dans la phase
  index(phase_id, manager_id)

Create table race_results:
  id: uuid pk
  course_id: text fk -> courses.id
  date_classement: date not null
  type_classement: enum('Etape','General','Points','Montagne','Jeune') not null
  etape_numero: int
  coureur_id: text fk -> coureurs.id
  position: int
  statut: enum('finished','dnf','dns','dsq') default 'finished'
  unique(course_id, type_classement, etape_numero, coureur_id)

Create table points_ledger:
  id: uuid pk
  phase_id: uuid fk -> phases.id
  course_id: text fk -> courses.id
  type_classement: enum('Etape','General','Points','Montagne','Jeune') not null
  etape_numero: int
  manager_id: uuid fk -> managers.id
  coureur_id: text fk -> coureurs.id
  points: int not null
  created_at: timestamp default now()
  index(phase_id, manager_id), index(course_id)

Create table audits:
  id: uuid pk
  actor_manager_id: uuid fk -> managers.id
  action: text not null
  payload_json: text
  created_at: timestamp default now()


# --- SEED SAISON & PHASES 2025 ---

Action "seed_saison_2025":
  upsert into saisons(annee) values (2025) returning id as saison_id
  insert into phases(saison_id,index_dans_saison,date_debut,date_fin,statut)
    values
      (saison_id,1,'2025-01-01','2025-03-23','draft'),
      (saison_id,2,'2025-03-24','2025-05-08','draft'),
      (saison_id,3,'2025-05-09','2025-07-05','draft'),
      (saison_id,4,'2025-07-06','2025-08-21','draft'),
      (saison_id,5,'2025-08-22','2025-12-31','draft')

# --- HELPERS ---

Action "compute_phase_for_course":
  input: course_id
  logic:
    load course by id -> d = date_debut
    find phase where d between date_debut and date_fin (same saison 2025)
    update courses set phase_id = found_phase.id

Action "bulk_compute_phases_for_all_courses":
  for each course with date_debut not null:
    run compute_phase_for_course(course.id)

Function "manager_budget_restant(phase_id, manager_id)":
  returns decimal
  = (select budget from phases where id=phase_id)
    - coalesce((select sum(prix_signature) from rosters where phase_id=phase_id and manager_id=manager_id),0)

# --- ENCHERES ---

Action "open_new_round":
  input: phase_id, deadline_at
  logic:
    last_round = coalesce(max(round_number) where auctions.phase_id=phase_id, 0)
    insert auctions(phase_id, round_number, deadline_at, statut='open')

Action "submit_bids_batch":
  input: phase_id, bids: array of {coureur_id, montant}
  steps:
    current_auction = select auctions where phase_id=phase_id and statut='open' order by round_number desc limit 1
    assert current_auction exists
    for each item in bids:
      assert montant >= (select prix_initial from coureurs where id=item.coureur_id)
      # pas d’interdiction d’équipes identiques, seulement unicité coureur
      assert not exists roster where phase_id=phase_id and coureur_id=item.coureur_id
      assert not exists bids where auction_id=current_auction.id and round_number=current_auction.round_number and manager_id=auth.user and coureur_id=item.coureur_id
      insert bids(auction_id,round_number,manager_id,coureur_id,montant,statut='pending')

Action "close_round":
  input: auction_id
  transaction:
    mark auctions.statut='closed', closed_at=now() where id=auction_id
    round = auctions.round_number
    phase_id = auctions.phase_id
    for each coureur_id with >=1 bids on (auction_id, round):
      max_bid = select max(montant) from bids where coureur_id and auction_id and round
      count_max = select count(*) where montant=max_bid and same scope
      if count_max > 1:
        update bids set statut='carried_over' where montant=max_bid and scope
        update bids set statut='lost' where montant<max_bid and scope
        continue
      # un seul gagnant
      gagnant = select * from bids where montant=max_bid limit 1
      if exists roster where phase_id=phase_id and coureur_id=coureur_id:
        update bids set statut='invalid' where id=gagnant.id
        update other bids set statut='lost'
        continue
      insert rosters(phase_id,manager_id=gagnant.manager_id,coureur_id,prix_signature=max_bid)
      update bids set statut='won' where id=gagnant.id
      update other bids set statut='lost'
    # si tous les managers ont 30 coureurs -> phases.statut = 'active'

View "manager_auction_summary":
  input: phase_id, manager_id
  returns:
    budget_restant: manager_budget_restant(phase_id, manager_id)
    nb_coureurs: count(rosters where phase_id & manager_id)
    offres: select bids for current open auction of phase_id by manager_id

# --- IMPORT RESULTATS & POINTS ---

Action "import_results_file":
  role: admin
  input: file (CSV/XLSX) with columns:
    course_id, date_classement(YYYY-MM-DD), type_classement in [Etape|General|Points|Montagne|Jeune],
    etape_numero (int or blank), coureur_id, position (int or blank), statut in [finished|dnf|dns|dsq]
  logic:
    parse file
    upsert lines into race_results with unique key (course_id,type_classement,etape_numero,coureur_id)

Function "points_for(categorie, type_classement, place)":
  returns int
  = coalesce((select points from scoring_rules where categorie=categorie and type_classement=type_classement and place=place), 0)

Action "compute_points_for_course":
  input: course_id
  transaction:
    course = select * from courses where id=course_id
    phase_id = course.phase_id
    for each r in race_results where course_id:
      pts = case when r.statut='finished' then points_for(course.categorie, r.type_classement, r.position) else 0 end
      if pts <= 0: continue
      for each roster where roster.coureur_id=r.coureur_id and roster.phase_id=phase_id:
        insert points_ledger(phase_id, course_id, r.type_classement, r.etape_numero, roster.manager_id, r.coureur_id, pts)

# --- LEADERBOARDS ---

View "leaderboard_course":
  input: course_id
  = select manager_id, sum(points) as total_points
    from points_ledger where course_id=course_id
    group by manager_id order by total_points desc

View "leaderboard_phase":
  input: phase_id
  = select manager_id, sum(points) as total_points
    from points_ledger where phase_id=phase_id
    group by manager_id order by total_points desc

View "leaderboard_season":
  input: saison_id
  = join phases p on p.saison_id=saison_id
    join points_ledger pl on pl.phase_id=p.id
    group by pl.manager_id sum(pl.points) as total_points
    order by total_points desc

# --- ADMIN OVERRIDE (AUDIT) ---

Action "admin_roster_override":
  role: admin
  input: phase_id, manager_id, coureur_id, prix_signature, op in ['add','remove']
  transaction:
    if op='add': insert rosters(...) on conflict do nothing
    if op='remove': delete from rosters where phase_id & manager_id & coureur_id
    insert audits(actor_manager_id=auth.user, action='roster_override', payload_json=payload)

Action "admin_points_override":
  role: admin
  input: payload { phase_id, course_id, manager_id, coureur_id, points, note }
  transaction:
    insert points_ledger(...)
    insert audits(action='points_override', payload_json=payload)

# --- ECRANS (UI) ---

Screen "Encheres (Manager)":
  header: "Mon budget restant", "Coureurs acquis (x/30)"
  left panel: Table Coureurs (recherche par nom, filtre equipe), colonne "Prix initial", input "Mon offre (décimal)"
  validation client: montant >= prix_initial, pas déjà acquis, pas déjà offert ce round
  primary button "Soumettre mes offres" -> action submit_bids_batch(phase)
  section "Mes offres & résultats du round" -> table bids du manager avec statut; afficher montant gagnant si statut='won'

Screen "Encheres (Admin)":
  controls:
    - Select Phase
    - Bouton "Ouvrir un round" (deadline datetime)
    - Bloc "Round en cours": deadline, bouton "Fermer le round" -> action close_round
  table "Résolution du round" (lecture) listant par coureur: top offre, égalité (→ carried_over), gagnant (→ manager & montant)

Screen "Résultats & Classements":
  filtres: Saison, Phase, Course (optionnel), Type de classement, Étape #
  panneau "Résultats officiels" -> table race_results (selon filtres)
  panneau "Points par manager (course)" -> view leaderboard_course
  panneaux "Classement Phase" -> view leaderboard_phase
           "Classement Général Saison" -> view leaderboard_season
  fiche manager (drawer) : roster + points par coureur

Screen "Import résultats (Admin)":
  uploader CSV/XLSX -> action import_results_file
  bouton "Calculer les points" (par course) -> action compute_points_for_course
  historique d’import (audit)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://monpetitcycliste.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6f69b568-4810-4214-b738-3c654c28408f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
