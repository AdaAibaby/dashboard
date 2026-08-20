  1. check .env.prod
  grep 'NEXT_PUBLIC_SITE_URL\|NEXT_PUBLIC_E2B_DOMAIN\|NEXT_PUBLIC_DASHBOARD_API_URL\|NEXT_PUBLIC_INFRA_API_URL' /home/sll/dashboard/.env.prod
  应该看到：
  NEXT_PUBLIC_SITE_URL=https://prod-e2b.xiaobei.top:3003
  NEXT_PUBLIC_E2B_DOMAIN=prod-e2b.xiaobei.top
  NEXT_PUBLIC_DASHBOARD_API_URL=http://192.168.162.20:3010
  NEXT_PUBLIC_INFRA_API_URL=http://192.168.162.20:3000


  2. build image（NEXT_PUBLIC_* must bupass --build-arg ，no runtime env）
  cd /home/sll/dashboard

  docker build \
    --build-arg NEXT_PUBLIC_SITE_URL=https://prod-e2b.xiaobei.top:3003 \
    --build-arg NEXT_PUBLIC_E2B_DOMAIN=prod-e2b.xiaobei.top \
    --build-arg NEXT_PUBLIC_DASHBOARD_API_URL=http://192.168.162.20:3010 \
    --build-arg NEXT_PUBLIC_INFRA_API_URL=http://192.168.162.20:3000 \
    --build-arg NEXT_PUBLIC_E2B_API_URL=http://192.168.162.20:3000 \
    --build-arg NEXT_PUBLIC_E2B_API_KEY=e2b_58a2f56000ef9074913f427ab0f7151c5f21 \
    --build-arg NEXT_PUBLIC_E2B_FORCE_HTTP=1 \
    --build-arg NEXT_PUBLIC_INCLUDE_BILLING=1 \
    --build-arg NEXT_PUBLIC_STRIPE_BILLING_URL=https://billing.stripe.com \
    --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_12345678901234567890 \
    --build-arg NEXT_PUBLIC_MOCK_DATA=0 \
    -t dashboard-prod \
    .

  3. check URL 
  docker run --rm --entrypoint grep dashboard-prod -r 'prod-e2b.xiaobei.top' /app/.next/server/chunks/4967.js | head -1
  
  get prod-e2b.xiaobei.top success
  get null recheck 

  4. Tag  and Push
  docker tag dashboard-prod mp-bp-cn-shanghai.cr.volces.com/e2b/dashboard-prod-ory:2026.22
  docker push mp-bp-cn-shanghai.cr.volces.com/e2b/dashboard-prod-ory:2026.22



5. run


docker run -d -p 3003:3000 -p 3031:3000 \
       --env-file /mnt/nfs/prod/.env.prod \
       -e RUN_MODE=prod \
       --name dashboard-sh-prod-ory \
       --restart always \
       --log-opt max-size=10m --log-opt max-file=3 \
       --network=bridge  \
       --workdir=/app  \
       --runtime=runc \
       --detach=true \
       mp-bp-cn-shanghai.cr.volces.com/e2b/dashboard-prod-ory:2026.22


/mnt/nfs/prod/.env.prod


docker run -d -p 3003:3000 -p 3031:3000 \
       -v /mnt/nfs/prod/.env.prod:/app/config/env_file \
       -e RUN_MODE=prod \
       --name dashboard-sh-prod \
       --restart always \
       --log-opt max-size=10m --log-opt max-file=3 \
       --network=bridge  \
       --workdir=/app  \
       --runtime=runc \
       --detach=true \
       mp-bp-cn-shanghai.cr.volces.com/e2b/dashboard-prod:latest


