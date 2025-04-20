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
      resource :dashboard, only: [ :show ]
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
