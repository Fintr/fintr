# Fintr AI - Backend
Fintr is a personal finance application with heavy integration with AI. Fintr will act as your personal financial instructor, wherein it recommend when you're free to buy your wants while hitting your budgets and goals.

## Infrastructure
- Rails API Backend
- Postgresql 17 (We should get the latest version as much as possible)
- RESTful API
- Serialization: Blueprinter
- Job Adapter: SolidQueue
- Caching Mechanism: SolidCache (vs Sidekiq/Redis) 
- Streaming Data: SolidCable
- Deployment: Kamal
- Github Actions for CI/CD

## Installation
1. See `.ruby-version` for ruby versioning
2. Install the ruby version. We prefer using [asdf](https://asdf-vm.com/) and [asdf-ruby](https://github.com/asdf-vm/asdf-ruby)
3. Get the .env credentials from `miko@fintr.ai`.
4. `bundle install`
5. `brew install vips`
6. Install docker and docker compose for mac or windows.
7. Run `docker-compose -f docker-compose.local.yml up -d`
8. Run `docker ps` and get the container_id of the app.
9. Run `docker exec -it <container_id> bash`
10. Run `psql -U fintr_admin -d postgres`
11. Run `ALTER USER fintr_rails WITH SUPERUSER;`
12. Run `rails db:create db:migrate db:seed` in project root

## How to get included in the seed

### Through Miko
Coordinate with Miko (miko@fintr.ai), you should log-in in staging. Then Miko will get the Auth0 Data you have in staging, put it in the seeders. After pushing the change and you're included in the `seed` files, you can run `rails db:seed`

### By yourself (You still need to ask how to get the data in staging)
1. Log in the [staging.fintr.ai](https://www.staging.fintr.ai)
2. Ask Miko how to ssh into the staging server.
3. `docker ps` and get the container_id of the app.
4. `docker exec -it <container_id> bash`
5. `bundle exec rails c` - Now you're in the console.
6. Find your User. It should likely be `Auth::User.last`
7. Add your `auth_id` in the `ENV["USER_AUTH0_ID"]` in `.env` and `.env.staging`
8. Tell everyone else that you've added an `auth_id` in those .env files.
9. Edit `db/seeds/01_user_seed.rb` and add your user_details based on position.
10. `rails db:seed`. Test it.
11. Create a PR for approval.

### Migration
To migrate, please run `make migrate`. We're using timescaledb for the pgvectorscale capabilities. It's adding up lines in the `schema.rb` that renders the application unable to use so this command will remove those lines from the schemas.

To remove the lines only, run `bundle exec rails db:clean_timescaledb_schemas`

### Download dump - EC2 # Deprecated
To download the dump it's a series of steps.
1. SSH into the server
2. You have to install postgresql17, `sudo dnf install -y postgresql17`
3. Run `pg_dump -u postgres -h <server_host> fintr_be_staging > staging.dump`
4. Go back to local terminal
5. Run `scp -i <fintr.pem> ec2-user@<ec2-host-address>:/home/ec2-user/staging.dump .`

## Handling .env files
Since we're using kamal, handling `.env` files is a little bit more primitive. We have local copies of the `.env.production` and `.env.staging`. Kamal will look at those `.env` files for reference and use those for production. Please coordinate with all other team members if you wish to update `.env.production` and `.env.staging`.

