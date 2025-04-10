# frozen_string_literal: true

Rails.application.routes.draw do
  # API routes
  namespace :api do
    namespace :v1 do
      # Auth0 authentication routes
      get "/auth/auth0/callback", to: "auth/auth0#callback"
      get "/auth/failure", to: "auth/auth0#failure"

      # User profile route
      get "/user/profile", to: "users#profile"

      # Other API resources
      resources :transactions
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
