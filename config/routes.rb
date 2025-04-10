# frozen_string_literal: true

Rails.application.routes.draw do
  # API routes
  namespace :api do
    namespace :v1 do
      namespace :auth do
      # Auth0 authentication routes
      get "/auth/auth0/callback", to: "auth0#callback"
      get "/auth/failure", to: "auth0#failure"

      # User profile route
      get "/user/profile", to: "users#profile"

      # Private routes
      get "/private", to: "private#private"
      get "/private_scoped", to: "private#private_scoped"
      end

      resources :transactions
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
