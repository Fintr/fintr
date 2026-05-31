# GCP VM networking (Kamal)

Kamal deploy can succeed while the site is unreachable from the internet. Check these in order.

## 1. GCP firewall (most common)

The VM must allow **inbound TCP 80 and 443** (and **22** for SSH). Kamal-proxy listens on `0.0.0.0:80` and `:443` inside the VM; if the VPC firewall blocks them, browsers time out.

**Console:** VPC network → Firewall → Create rule

| Field | Value |
|--------|--------|
| Targets | All instances (or your VM’s network tag) |
| Source | `0.0.0.0/0` (or your office IP for testing) |
| Protocols | tcp:80,443 |

**gcloud** (replace `PROJECT_ID` and network tag if you use tags):

```bash
gcloud compute firewall-rules create allow-http-https \
  --project=PROJECT_ID \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server,https-server
```

Ensure the VM has tags `http-server` and `https-server`, or adjust `--target-tags` / use `--rules` on the default allow rule.

**Verify from your laptop:**

```bash
nc -zv 34.21.206.91 80 443
curl -sI http://34.21.206.91/
curl -sI https://gcp.fintr.ai/
```

## 2. DNS

`gcp.fintr.ai` must be an **A record** to the VM IP (e.g. `34.21.206.91`):

```bash
dig +short gcp.fintr.ai
```

## 3. Hostname vs bare IP (Kamal-proxy)

Kamal routes by **Host** header, not only by IP.

| URL | Typical result on GCP setup |
|-----|-----------------------------|
| `https://gcp.fintr.ai` | **Frontend** (`fintr-fe`) — use this for the app |
| `http://34.21.206.91` | **API** (`fintr-be`) — often **404** on `/` (no HTML root) |
| `http://gcp.fintr.ai` | Redirects to **HTTPS** when `KAMAL_PROXY_SSL=true` |

Frontend deploy sets `proxy.host` to `gcp.fintr.ai`. Backend GCP deploy uses `proxy.host: 34.21.206.91` for the API.

## 4. On-VM smoke tests (SSH)

```bash
ssh miguel.dagatan@34.21.206.91

docker ps --format 'table {{.Names}}\t{{.Ports}}'
# Expect kamal-proxy with 0.0.0.0:80->80 and 0.0.0.0:443->443

curl -sI http://127.0.0.1/ -H 'Host: gcp.fintr.ai'   # often 301 → https
curl -skI --resolve gcp.fintr.ai:443:127.0.0.1 https://gcp.fintr.ai/
curl -sI http://127.0.0.1/up -H 'Host: 34.21.206.91'  # API health → 200
```

If these work on the VM but not from your laptop, the problem is **firewall or cloud edge**, not Kamal.

## 5. TLS

With `KAMAL_PROXY_SSL=true` in `.env.gcp.production`, use **`https://gcp.fintr.ai`**. Port 80 may only redirect to HTTPS.

Let's Encrypt requires port **80** reachable from the public internet when the certificate is first issued.
