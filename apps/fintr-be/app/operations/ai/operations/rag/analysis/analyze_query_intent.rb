# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      module Analysis
        # Analyzes user query to determine data requirements using Dry::Operation
        class AnalyzeQueryIntent < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:query).value(:string)
              required(:space_id).value(:string)
              optional(:conversation_context).maybe(:string)
            end
          end

          def initialize(
            provider: nil,
            model_selector: nil
          )
            super()
            @provider = provider || Ai::Providers::ProviderFactory.create(:openrouter)
            @model_selector = model_selector || Ai::Providers::ModelSelector
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)
            prompt = step build_prompt(params:)
            response = step call_llm(params:, prompt:)
            analysis = step parse_response(response:)

            analysis
          end

          private

          def build_prompt(params:)
            prompt = Ai::Prompts::PromptService.analysis_prompt(
              query: params[:query],
              space_id: params[:space_id],
              context: params[:conversation_context],
            )
            Success(prompt)
          end

          def call_llm(params:, prompt:)
            response = @provider.chat(
              messages: [{ role: "user", content: prompt }],
              model: @model_selector.for_analysis,
              temperature: 0.1,
            )

            Success(response)
          rescue StandardError => e
            Rails.logger.error "[AnalyzeQueryIntent#call_llm] Error: #{e.message}"
            Failure(llm_error: e.message)
          end

          def parse_response(response:)
            content = response.is_a?(Hash) ? response[:content] : response
            content = content.to_s

            # Extract JSON from response
            json_match = content.match(/\{.*\}/m)
            return Success(default_analysis) if json_match.nil?

            parsed = JSON.parse(json_match[0], symbolize_names: true)
            Success(normalize_analysis(parsed))
          rescue JSON::ParserError => e
            Rails.logger.warn "[AnalyzeQueryIntent#parse_response] JSON parse error: #{e.message}"
            Success(default_analysis)
          end

          def normalize_analysis(parsed)
            {
              query_type: parsed[:query_type] || "spending_analysis",
              data_sources: Array(parsed[:data_sources]),
              aggregations: parsed[:aggregations] || {},
              filters: parsed[:filters] || {},
              time_range: parsed[:time_range] || { period: "this_month" },
              sorting: parsed[:sorting] || { field: "amount", direction: "desc" },
              limit: [parsed[:limit] || 10, 50].min,
              chart_suggestion: parsed[:chart_suggestion] || { should_include_chart: false }
            }
          end

          def default_analysis
            current_date = Date.current
            {
              query_type: "spending_analysis",
              data_sources: ["transactions"],
              aggregations: { group_by: ["category"], metrics: ["sum", "count"] },
              filters: { transaction_type: ["expense"] },
              time_range: {
                period: "this_month",
                start_date: current_date.beginning_of_month.strftime("%Y-%m-%d"),
                end_date: current_date.end_of_month.strftime("%Y-%m-%d")
              },
              sorting: { field: "amount", direction: "desc" },
              limit: 10,
              chart_suggestion: { should_include_chart: false }
            }
          end
        end
      end
    end
  end
end
