# Versioning & Release

## Vue d'ensemble

Chaque push sur `main` déclenche le workflow GitHub Actions `Release & Deploy` qui :
1. Build l'application Angular
2. Déploie sur Firebase Hosting
3. Analyse les commits pour déterminer si une nouvelle version doit être publiée
4. Si oui : incrémente la version, met à jour le CHANGELOG, crée un tag git et une GitHub Release

---

## Messages de commit

Le type de bump de version est déterminé automatiquement par le **préfixe** du message de commit.

### Format

```
<préfixe>: <description courte>
```

Exemples :
```
feat: ajout des notifications de remplacement
fix: correction de l'ordre d'affichage de la rotation
chore: mise à jour des dépendances npm
```

### Préfixes et impact sur la version

| Préfixe | Signification | Impact version |
|---------|--------------|----------------|
| `feat` | Nouvelle fonctionnalité | **MINOR** — `x.1.0` |
| `fix` | Correction de bug | **PATCH** — `x.x.1` |
| `feat!` ou `BREAKING CHANGE:` | Rupture de compatibilité | **MAJOR** — `2.0.0` |
| `chore` | Maintenance, dépendances, config | aucun |
| `docs` | Documentation uniquement | aucun |
| `test` | Ajout ou modification de tests | aucun |
| `refactor` | Refactoring sans bug ni fonctionnalité | aucun |
| `perf` | Amélioration de performance | aucun |
| `ci` | Modifications des workflows CI/CD | aucun |

### Priorité en cas de commits multiples

Quand un push contient plusieurs commits, le niveau le plus élevé l'emporte :

```
MAJOR > MINOR > PATCH > aucun
```

Exemples :

| Commits dans le push | Résultat |
|---------------------|----------|
| `feat: ...` + `fix: ...` | MINOR |
| `fix: ...` + `chore: ...` | PATCH |
| `feat!: ...` + `feat: ...` | MAJOR |
| `chore: ...` + `ci: ...` | aucun bump |

---

## Versioning sémantique (SemVer)

La version suit le format `MAJOR.MINOR.PATCH` :

- **MAJOR** : changement incompatible avec les versions précédentes
- **MINOR** : nouvelle fonctionnalité rétrocompatible (remet PATCH à 0)
- **PATCH** : correction de bug rétrocompatible

Exemples de progression :

```
1.2.3
  └─ fix: ...        → 1.2.4
  └─ feat: ...       → 1.3.0
  └─ feat!: ...      → 2.0.0
```

---

## Ce qui est créé à chaque release

- `package.json` : version mise à jour
- `CHANGELOG.md` : entrée ajoutée avec les commits `feat` et `fix` du push
- Tag git : `v1.2.3`
- GitHub Release : avec le contenu du CHANGELOG correspondant

---

## Ce qui se passe si aucun bump n'est nécessaire

Le deploy Firebase a lieu quand même, mais **aucun tag, aucune release, aucun commit de version** n'est créé. Le CHANGELOG reste inchangé.
