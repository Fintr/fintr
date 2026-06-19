# frozen_string_literal: true

require "rails_helper"

RSpec.describe "RAG topic search integration" do # rubocop:disable RSpec/DescribeClass
  let(:space) { create(:space) }
  let(:dine_out_category) { create(:category, :expense, space: space, name: "Dine Out & Entertainment") }
  let(:dine_out_subcategory) do
    create(
      :category,
      :subcategory,
      space: space,
      parent: dine_out_category,
      name: "Dine out",
    )
  end
  let(:transport_category) { create(:category, :expense, space: space, name: "Transport") }
  let(:account) { create(:account, space: space) }
  let(:period_date) { Date.current.last_month.change(day: 15) }

  let(:vector_searcher) { instance_double(Ai::Rag::VectorSearcher) }
  let(:resolver) { Ai::Rag::SemanticTransactionResolver.new(vector_searcher: vector_searcher) }

  before do
    allow(Ai::Rag::SemanticTransactionResolver).to receive(:new).and_return(resolver)
  end

  def build_analysis(search_term:, period: "last_month")
    Ai::Rag::AnalysisResult.new(
      query_type: "spending_analysis",
      data_sources: ["transactions"],
      aggregations: {},
      filters: {
        transaction_type: ["expense"],
        search_term: search_term
      },
      time_range: { period: period },
      sorting: { field: "amount", direction: "desc" },
      limit: 10,
      chart_suggestion: { should_include_chart: false },
      space_id: space.id,
    )
  end

  def vector_result_for(transaction, distance:)
    subcategory_label = transaction.subcategory&.name
    category_label = [transaction.category.name, subcategory_label].compact.join(", ")

    {
      id: SecureRandom.uuid,
      embeddable_id: transaction.id,
      embeddable_type: "Transactions::Transaction",
      content: "#{transaction.description}. -#{transaction.amount.format} expense " \
               "in #{category_label} via #{transaction.account.name} " \
               "on #{transaction.date.strftime('%B %d, %Y')}.",
      metadata: {
        "category" => transaction.category.name,
        "subcategory" => subcategory_label,
        "description" => transaction.description,
        "account" => transaction.account.name,
        "date" => transaction.date.iso8601
      },
      distance: distance,
      similarity_score: 1 - distance
    }
  end

  def stub_vector_search_to_return(transactions, distance: 0.55)
    allow(vector_searcher).to receive(:search) do |**kwargs|
      expect(kwargs[:query]).to eq("dining spending") if kwargs[:query].to_s.include?("dining")
      transactions.map { |txn| vector_result_for(txn, distance: distance) }
    end
  end

  describe "spending totals for dining queries" do
    let!(:lansangan) do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "Lansangan Meals",
        amount_cents: 2_080_00,
        date: period_date,
      )
    end

    let!(:mcdonalds) do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "McDonald's",
        amount_cents: 169_00,
        date: period_date,
      )
    end

    let!(:carinderia) do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "Carinderia",
        amount_cents: 198_00,
        date: period_date,
      )
    end

    let!(:fuel_purchase) do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: transport_category,
        description: "Gas station fill-up",
        amount_cents: 1_500_00,
        date: period_date,
      )
    end

    it "includes dine out transactions via vector search when text does not contain the query word" do
      stub_vector_search_to_return([lansangan, mcdonalds, carinderia])

      result = Ai::Rag::DataRetriever.new.retrieve(build_analysis(search_term: "dining"))

      aggregate = result.first
      expect(aggregate[:count]).to eq(3)
      expect(aggregate[:total_cents]).to eq(2_080_00 + 169_00 + 198_00)
      expect(aggregate[:transactions].map { |txn| txn[:id] }).not_to include(fuel_purchase.id)
    end

    it "returns every dine out transaction from QueryBuilder, not only text matches" do
      stub_vector_search_to_return([lansangan, mcdonalds, carinderia])

      query = Ai::Rag::QueryBuilder.new.for_spending(build_analysis(search_term: "dining"))
      matched_ids = query.pluck(:id)

      expect(matched_ids).to contain_exactly(lansangan.id, mcdonalds.id, carinderia.id)
      expect(matched_ids).not_to include(fuel_purchase.id)
    end

    it "unions literal text matches with vector matches" do
      fine_dining = create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "Fine dining experience",
        amount_cents: 1_000_00,
        date: period_date,
      )

      stub_vector_search_to_return([lansangan, mcdonalds])

      query = Ai::Rag::QueryBuilder.new.for_spending(build_analysis(search_term: "dining"))
      matched_ids = query.pluck(:id)

      expect(matched_ids).to include(fine_dining.id, lansangan.id, mcdonalds.id)
    end

    it "excludes pet food when vector search also returns a weak pet match" do
      pet_category = create(:category, :expense, space: space, name: "Pet")
      dog_food = create(
        :expense_transaction,
        space: space,
        account: account,
        category: pet_category,
        description: "Dog Food",
        amount_cents: 4_766_00,
        date: period_date,
      )

      allow(vector_searcher).to receive(:search) do
        [
          vector_result_for(lansangan, distance: 0.45),
          vector_result_for(mcdonalds, distance: 0.46),
          vector_result_for(carinderia, distance: 0.47),
          vector_result_for(dog_food, distance: 0.55)
        ]
      end

      result = Ai::Rag::DataRetriever.new.retrieve(build_analysis(search_term: "dining"))

      expect(result.first[:count]).to eq(3)
      expect(result.first[:total_cents]).to eq(2_080_00 + 169_00 + 198_00)
    end
  end

  describe "queries that should not match unrelated categories" do
    let!(:dine_out_meal) do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "Lansangan Meals",
        amount_cents: 500_00,
        date: period_date,
      )
    end

    let!(:pool_membership) do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        description: "Community pool membership",
        amount_cents: 300_00,
        date: period_date,
      )
    end

    it "only totals vector-selected transactions and excludes unrelated dine out spend" do
      allow(vector_searcher).to receive(:search).and_return(
        [vector_result_for(pool_membership, distance: 0.48)],
      )

      result = Ai::Rag::DataRetriever.new.retrieve(build_analysis(search_term: "swimming"))

      aggregate = result.first
      expect(aggregate[:count]).to eq(1)
      expect(aggregate[:total_cents]).to eq(300_00)
      expect(aggregate[:transactions].map { |txn| txn[:id] }).to eq([pool_membership.id])
      expect(aggregate[:transactions].map { |txn| txn[:id] }).not_to include(dine_out_meal.id)
    end

    it "does not expand swine queries to dine out categories" do
      allow(vector_searcher).to receive(:search).and_return([])

      result = Ai::Rag::DataRetriever.new.retrieve(build_analysis(search_term: "swine"))

      expect(result).to eq([])
    end
  end

  describe Ai::Rag::Agent::Tools::QueryFinancialData do
    let(:collector) { Ai::Rag::Agent::RetrievalCollector.new }

    it "formats the full dining total for the agent" do
      lansangan = create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "Lansangan Meals",
        amount_cents: 2_080_00,
        date: period_date,
      )
      mcdonalds = create(
        :expense_transaction,
        space: space,
        account: account,
        category: dine_out_category,
        subcategory: dine_out_subcategory,
        description: "McDonald's",
        amount_cents: 169_00,
        date: period_date,
      )

      stub_vector_search_to_return([lansangan, mcdonalds])

      tool = described_class.new(
        space_id: space.id,
        collector: collector,
      )

      result = tool.execute(
        query_type: "spending_analysis",
        period: "last_month",
        search_term: "dining",
      )

      expect(result).to include("Total:")
      expect(result).to include("across 2 transactions")
      expect(result).to include("Lansangan Meals")
      expect(result).to include("McDonald's")
    end
  end
end
