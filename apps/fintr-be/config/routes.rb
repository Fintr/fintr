# frozen_string_literal: true

require "solid_queue_monitor"

Rails.application.routes.draw do
  mount SolidQueueMonitor::Engine => "/solid_queue"
  # API routes
  namespace :api do
    namespace :v1 do
      # E2E test endpoints (development only)
      namespace :e2e do
        post "/setup", to: "test_setup#setup"
        post "/reset", to: "test_setup#reset"
      end

      # Public endpoint for mobile app cache version check (no auth)
      get "/cache_version", to: "cache_version#show"

      namespace :auth do
        # Public routes (no authentication required)
        post "/login", to: "login#create"
        post "/signup", to: "signup#create"
        post "/refresh", to: "refresh#create"
        post "/google/callback", to: "google#callback"
        post "/oauth/callback", to: "oauth#callback" # Generic OAuth callback for all providers

        # Private routes
        get "/private", to: "private#private"
        get "/private_scoped", to: "private#private_scoped"

        get "/user", to: "user#index"
        patch "/user", to: "user#update"
        post "/user/reset_password", to: "user#reset_password"
        delete "/user", to: "user#delete_account"

        post "/tutorial/complete", to: "tutorial#complete"
      end

      namespace :admin do
        resources :product_pulse_feedbacks, only: %i[index]
        resources :users, only: %i[index]
        resources :user_activity, only: [] do
          collection do
            get :analytics
            get :daily_active_users
            get :activity_drilldown
          end
        end
        namespace :ai do
          resources :ai_interactions, only: %i[index show] do
            collection do
              get :stats
            end
          end
        end
        resource :cache, only: [:show] do
          collection do
            post :clear
          end
        end
        namespace :finance do
          resources :sponsor_codes, only: %i[index show create update destroy]
          resources :free_subscriptions, only: %i[create] do
            collection do
              delete :remove
              get :spaces
            end
          end
        end
      end

      namespace :ai do
        resource :usage, only: [:show]

        # RAG endpoints
        post "/rag/query", to: "rag#query"
        get "/rag/status/:session_id", to: "rag#status"
        post "/rag/generate_embeddings", to: "rag#generate_embeddings"

        # Conversations endpoints
        resources :conversations, only: %i[index show create update destroy]

        # Responses endpoints
        resources :responses, only: [:create] do
          collection do
            post :stream
          end
        end
      end

      # Use scope to keep the URL prefix without namespace nesting for controllers
      scope path: "transactions", module: "transactions" do
        resources :categories, only: %i[index create update destroy] do
          member do
            post :preview_conversion
            post :convert
          end
        end
        resources :tags, only: %i[index create update destroy] do
          member do
            put :toggle_default
            post :generate_style_image
          end
        end
        resources :accounts, only: %i[index create update destroy] do
          member do
            post "adjust_balance"
            get "activities"
            get "balance_timeline"
          end
        end
        resources :transfers, only: %i[create show update destroy]
        resources :drafts, only: %i[index]
        resources :loans, only: %i[index show create update destroy] do
          resources :loan_payments, only: %i[index show create update destroy]
        end
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
          get :note_suggestions
        end
      end

      resources :exchange_rates, only: [] do
        collection do
          get :current
          get :recent
          post :batch
        end
      end

      resource :onboardings, only: %i[create show]
      resources :attachments, only: [] do
        collection do
          get :download
        end
      end
      resources :budgets, only: %i[index create update destroy]
      resources :entities, only: %i[index show create update] do
        member do
          post :search_photos
          post :generate_photo
        end

        resources :identifiers,
                  only: %i[create destroy],
                  controller: "entities/identifiers"
      end
      resources :insights, only: [:index] do
        collection do
          get :summary
          get :health_scores
          get :expense_breakdown
          get :weekly_spending
          get :monthly_spending
          get :account_breakdown
          get :narratives
        end
      end
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

      # Raw monthly summary buckets for offline/insights combine-on-client.
      resources :monthly_financial_summaries, only: [:index]

      resources :product_pulse_feedbacks, only: %i[create]

      namespace :achievements do
        resource :profile, only: [:show]
        resources :achievements, only: [:index]
      end

      namespace :imports do
        resources :imports, only: [:index, :show, :create] do
          member do
            post :revert
          end
          resources :import_records, only: [:index, :show, :update] do
            member do
              post :import
            end
          end
        end
        resource :sample_template, only: [:show]
      end

      # Space management routes
      namespace :spaces do
        get "sync/changes", to: "sync#changes"
        get "sync/bootstrap", to: "sync#bootstrap"
      end

      resources :spaces, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :join
          delete :leave
          post :mark_seen
          post :transfer_ownership
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

      # Finance routes
      namespace :finance do
        resources :subscriptions, only: %i[index create update] do
          collection do
            get :current_subscriptions
            post :simulate_cycle_payment
            post :force_attempt_cycle
          end
          member do
            post :cancel
          end
        end
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check

  # Action Cable mount point
  mount ActionCable.server => "/cable"

  # Webhook endpoints (external API callbacks - no authentication required)
  namespace :webhooks do
    post "/xendit", to: "xendit#create"
  end
end
