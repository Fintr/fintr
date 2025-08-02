migrate:
	bundle exec rails db:migrate parallel:prepare 

db-setup:
	if [ -f db/schema.rb ]; then rm db/schema.rb; fi
	bundle exec rails db:drop parallel:drop db:create db:migrate db:seed parallel:create

test:
	bundle exec rails parallel:spec

rubocop:
	bundle exec rubocop -A
