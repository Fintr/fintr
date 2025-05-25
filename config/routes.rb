# frozen_string_literal: true

Rails.application.routes.draw do
  # API routes
  namespace :api do
    namespace :v1 do
      namespace :auth do
        # Private routes
        get "/private", to: "private#private"
        get "/private_scoped", to: "private#private_scoped"
      end

      resources :transactions
      resources :budgets, only: %i[index create update destroy]
      resources :insights, only: [:index]

      # Use scope to keep the URL prefix without namespace nesting for controllers
      scope path: "transactions", module: "transactions" do
        resources :categories, only: [:create]
        resources :accounts, only: [:create]
        resources :transfers, only: [:create]
      end

      resource :dashboard, only: [:show]
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
