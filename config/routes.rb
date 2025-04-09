# frozen_string_literal: true

Rails.application.routes.draw do
  # API routes
  namespace :api do
    namespace :v1 do
      devise_for :users,
                 # NOTE: routes are still /api/v1/users/controllers
                 controllers: {
                   registrations: "api/v1/auth/registrations",
                   sessions: "api/v1/auth/sessions",
                   confirmations: "api/v1/auth/confirmations",
                   passwords: "api/v1/auth/passwords",
                   unlocks: "api/v1/auth/unlocks"
                 },
                 defaults: { format: :json },
                 skip: :omniauth_callbacks
    end
  end


  get "up" => "rails/health#show", as: :rails_health_check
end
