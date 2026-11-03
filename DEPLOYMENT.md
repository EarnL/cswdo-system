# Deploy React to Netlify and Django to Render

The project is prepared for a Git-based testing deployment. The included Render
Blueprint creates a Free web service and Free PostgreSQL database, without a
persistent disk. The database expires 30 days after creation. Uploaded photos,
reports, and preparation evidence are temporary and can disappear on restart,
redeploy, or service spin-down. Use disposable test data only.

Free services sleep after 15 minutes without inbound traffic. The first request
can take about a minute to wake the service. If Netlify times out, open the
backend `/health/` URL, wait for it to respond, then retry the frontend.

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
including `https://`, without a trailing slash. Use `cswdo-system` as the
Blueprint name. Confirm both resource plans show **Free**, then create it.
If an old setup still shows paid plans, cancel and restart Blueprint creation
from the latest `main` branch. If Render still requires payment verification,
do not enter a card for this testing setup; check its account requirements.

The Blueprint installs Python dependencies, collects Django admin static files,
creates PostgreSQL, generates a secret key, disables debug mode, runs migrations
on startup, and starts one Gunicorn worker to reduce memory use.

After deployment, check `https://YOUR_BACKEND.onrender.com/health/`.
It should return `{"status": "ok"}` after verifying a database connection.

Free Render services do not provide a web service Shell. Create the first
administrator from your local PowerShell terminal using the database's
**External Database URL** from Render's connection panel. Keep this credential
private. With Python 3.12 or newer and project requirements installed, run:

```powershell
$env:DATABASE_URL = Read-Host 'Paste the Render External Database URL' -MaskInput
$env:DEBUG = 'True'
python manage.py createsuperuser
```

On Windows PowerShell 5.1, which lacks `-MaskInput`, use
`$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', (Read-Host 'Paste the Render External Database URL' -AsSecureString)).Password`
instead. Run these commands after Render finishes its initial migrations.

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
When finished, clear the remote connection from that local terminal with
`Remove-Item Env:DATABASE_URL` and `Remove-Item Env:DEBUG`.

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
- Restart the Render service and confirm database records remain available;
  expect uploaded files to be lost on this free setup.
- Verify token refresh and sign out.

Netlify proxy requests have a 26 second timeout. Operations that exceed that
need a background-job design or a separate download strategy.

## Existing local data

The Render database starts empty except for schema migrations. To move your
current records, make a PostgreSQL backup and restore it to Render using the
connection information in your Render dashboard. The free database expires
after 30 days, so export any test records you want to keep before then.
Uploads are temporary on the free service; persistent file storage needs a
separate storage provider or a paid disk. Do not put backups in Git.

## Local development

Install backend dependencies with `python -m pip install -r requirements.txt`.
Existing `POSTGRES_*` variables continue to work locally. `DEBUG` defaults to
`True` locally; the Render Blueprint explicitly sets it to `False`.
For production, `SECRET_KEY` is required and `DATABASE_URL` overrides local
PostgreSQL settings. `ALLOWED_HOSTS` can add comma-separated hostnames; Render's
assigned hostname is added automatically.

References: [Render Django deployment](https://render.com/docs/deploy-django),
[Render persistent disks](https://render.com/docs/disks),
[Render free plan limits](https://render.com/docs/free),
[Netlify React setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/react/),
[Netlify rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
