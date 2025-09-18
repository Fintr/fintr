# frozen_string_literal: true

Rails.application.routes.draw do
  # API routes
  namespace :api do
    namespace :v1 do
      namespace :auth do
        # Private routes
        get "/private", to: "private#private"
        get "/private_scoped", to: "private#private_scoped"

        get "/user", to: "user#index"
        patch "/user", to: "user#update"
        post "/user/reset_password", to: "user#reset_password"
      end

      namespace :admin do
        resources :users, only: %i[index]
      end

      namespace :ai do
        resource :usage, only: [:show]
      end

      # Use scope to keep the URL prefix without namespace nesting for controllers
      scope path: "transactions", module: "transactions" do
        resources :categories, only: %i[index create update destroy]
        resources :accounts, only: %i[index create update destroy]
        resources :transfers, only: %i[create show update destroy]
        resources :drafts, only: %i[index]
      end

      scope path: "goals", module: "goals" do
        resource :description, only: [:update]
      end

      namespace :crm do
        resources :tickets, only: %i[index show create] do
          resources :responses, only: [:create], controller: "ticket_responses"
        end

        namespace :admin do
          resources :tickets, only: %i[index show update] do
            member do
              post :respond
            end
          end
        end
      end

      resources :transactions do
        collection do
          get :generate_csv
        end
      end
      resource :onboardings, only: %i[create show]
      resources :budgets, only: %i[index create update destroy]
      resources :insights, only: [:index]
      resources :receipts, only: [:create] do
        collection do
          post :process_test
        end
      end

      resource :dashboard, only: [:show] do
        collection do
          post :reset_data
        end
      end

      # Space management routes
      resources :spaces, only: [:index, :show, :create] do
        member do
          post :join
          delete :leave
        end
        
        resources :users, module: :spaces, only: [:index] do
          collection do
            post :grant_access
          end
          member do
            delete :remove
          end
        end
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
