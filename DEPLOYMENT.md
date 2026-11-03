# Deploy React to Netlify and Django to Render

The project is prepared for a Git-based deployment. It is not published yet.
The included Render Blueprint creates a paid Starter web service, a paid
PostgreSQL database, and a 1 GB persistent disk. Review the prices shown in
Render before creating resources. The disk preserves uploaded photos, reports,
and preparation evidence across restarts and deployments.

## 1. Put the project in a private GitHub repository

Run these commands in the project root if you have not initialized Git:

```powershell
git init
git add .
git status
git commit -m "Prepare Netlify and Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Before committing, check the staged files. The root `.gitignore` excludes
uploads, backups, environment files, dependencies, logs, and generated builds.
Do not commit real client records or credentials. Existing local database
records and uploads are not transferred by Git.

## 2. Reserve the Netlify site URL

In Netlify, create a project by importing the GitHub repository. Configuration
comes from the root `netlify.toml`:

| Setting | Value |
| --- | --- |
| Base directory | `frontend` |
| Build command | `npm run build && node scripts/netlify-redirects.cjs` |
| Publish directory | `build` (relative to `frontend`) |
| Node version | `22` |

The existing frontend has three unused-variable lint warnings. `CI=false` in
the Netlify build environment allows the production build to finish with these
warnings; build errors still fail deployment.

Copy the assigned site origin, for example `https://your-site.netlify.app`.
The first build may fail until you set `BACKEND_URL` in step 4; the build
deliberately rejects a missing backend URL.

## 3. Deploy the backend on Render

In Render, create a **Blueprint**, connect the same repository, and select the
root `render.yaml`. Set the prompted `FRONTEND_URL` to the exact Netlify origin,
including `https://`, without a trailing slash. Review the paid resources and
create the Blueprint.

The Blueprint installs Python dependencies, collects Django admin static files,
creates PostgreSQL, generates a secret key, disables debug mode, mounts upload
storage, runs migrations on startup, and starts Gunicorn.

After deployment, check `https://YOUR_BACKEND.onrender.com/health/`.
It should return `{"status": "ok"}` after verifying a database connection.

In the Render web service Shell, create your first administrator:

```sh
python manage.py createsuperuser
```

If your application needs its custom administrator role set explicitly, run:

```sh
python manage.py shell
```

```python
from core.models import User
user = User.objects.get(username='YOUR_ADMIN_USERNAME')
user.role = 'admin'
user.save(update_fields=['role'])
```

The Django admin is at `https://YOUR_BACKEND.onrender.com/admin/`.
The frontend `/admin` route is the React administrator dashboard.

## 4. Connect Netlify to Render

In Netlify project environment variables, set:

```text
BACKEND_URL=https://YOUR_BACKEND.onrender.com
```

Use only the HTTPS backend origin, without `/api`. Trigger a new deployment.
The build generates `_redirects` to proxy `/api/*` and `/media/*` to Render,
then serves React for application routes. The frontend keeps its existing
`/api` configuration, including token refresh requests.

Render's `FRONTEND_URL` also makes uploaded-file URLs point back through Netlify.
This keeps protected image and download requests on the same origin as their
authentication cookie. Update `FRONTEND_URL` if you change the Netlify domain.

## 5. Verify the live application

- Sign in through Netlify and verify the correct role dashboard opens.
- Refresh a nested frontend route; it should still load.
- Create a record and upload a test photo or PDF.
- Open the upload and confirm another unauthorized account cannot access it.
- Restart the Render service and confirm the record and upload remain available.
- Verify token refresh and sign out.

Netlify proxy requests have a 26 second timeout. Operations that exceed that
need a background-job design or a separate download strategy.

## Existing local data

The Render database starts empty except for schema migrations. To move your
current records, make a PostgreSQL backup and restore it to Render using the
connection information in your Render dashboard. Copy `media/` to
`/var/data/media/` and `private_media/` to `/var/data/private_media/` through an
authenticated transfer. Do not put data backups in the Git repository.

## Local development

Install backend dependencies with `python -m pip install -r requirements.txt`.
Existing `POSTGRES_*` variables continue to work locally. `DEBUG` defaults to
`True` locally; the Render Blueprint explicitly sets it to `False`.
For production, `SECRET_KEY` is required and `DATABASE_URL` overrides local
PostgreSQL settings. `ALLOWED_HOSTS` can add comma-separated hostnames; Render's
assigned hostname is added automatically.

References: [Render Django deployment](https://render.com/docs/deploy-django),
[Render persistent disks](https://render.com/docs/disks),
[Netlify React setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/react/),
[Netlify rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
