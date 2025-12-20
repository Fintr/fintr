# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Queries::ListImports, type: :query do
  let!(:user) { create(:user) }
  let!(:space) { create(:space) }

  let!(:import1) do
    create(
      :import,
      user: user,
      space: space,
      status: "completed",
      created_at: 3.days.ago
    )
  end

  let!(:import2) do
    create(
      :import,
      user: user,
      space: space,
      status: "pending",
      created_at: 1.day.ago
    )
  end

  let!(:import3) do
    create(
      :import,
      user: user,
      space: space,
      status: "failed",
      created_at: 2.days.ago
    )
  end

  let!(:import4) do
    create(
      :import,
      user: user,
      space: space,
      status: "completed",
      created_at: 4.days.ago
    )
  end

  describe "#call" do
    let(:base_relation) { Imports::Import.all }

    context "without any filters" do
      subject(:query_result) { query.call }

      let(:query) { described_class.new(relation: base_relation, page: 1) }


      it "returns a success" do
        expect(query_result).to be_success
      end

      it "returns all imports ordered by recent (created_at desc)" do
        imports = query_result.value!

        # Check that all imports are returned
        expect(imports.count).to eq(4)

        # Check default ordering (most recent first)
        import_ids = imports.map(&:id)
        expect(import_ids.first).to eq(import2.id) # 1 day ago (most recent)
        expect(import_ids[1]).to eq(import3.id)   # 2 days ago
        expect(import_ids[2]).to eq(import1.id)   # 3 days ago
        expect(import_ids.last).to eq(import4.id) # 4 days ago (oldest)
      end

      it "applies pagination" do
        imports = query_result.value!

        # Check that pagination methods are available
        expect(imports).to respond_to(:current_page)
        expect(imports).to respond_to(:total_pages)
        expect(imports).to respond_to(:total_count)
      end
    end

    context "with status filter" do
      it "filters by completed status" do
        result = described_class.new(relation: base_relation, status: "completed", page: 1).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(2)
        expect(imports.map(&:id)).to contain_exactly(import1.id, import4.id)
      end

      it "filters by pending status" do
        result = described_class.new(relation: base_relation, status: "pending", page: 1).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(1)
        expect(imports.first.id).to eq(import2.id)
      end

      it "filters by failed status" do
        result = described_class.new(relation: base_relation, status: "failed", page: 1).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(1)
        expect(imports.first.id).to eq(import3.id)
      end

      it "returns empty result for non-matching status" do
        result = described_class.new(relation: base_relation, status: "reverted", page: 1).call

        expect(result).to be_success
        imports = result.value!

        expect(imports).to be_empty
      end
    end

    context "with pagination" do
      it "applies page parameter" do
        result = described_class.new(relation: base_relation, page: 1, per_page: 2).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(2)
        expect(imports.current_page).to eq(1)
        expect(imports.total_count).to eq(4)
      end

      it "applies per_page parameter" do
        result = described_class.new(relation: base_relation, page: 1, per_page: 1).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(1)
        expect(imports.current_page).to eq(1)
        expect(imports.total_count).to eq(4)
      end

      it "returns second page results" do
        result = described_class.new(relation: base_relation, page: 2, per_page: 2).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(2)
        expect(imports.current_page).to eq(2)
        expect(imports.total_count).to eq(4)
      end

      it "returns empty results for page beyond available data" do
        result = described_class.new(relation: base_relation, page: 5, per_page: 2).call

        expect(result).to be_success
        imports = result.value!

        expect(imports).to be_empty
        expect(imports.current_page).to eq(5)
        expect(imports.total_count).to eq(4)
      end
    end

    context "with status filter and pagination" do
      it "combines status filter with pagination" do
        result = described_class.new(relation: base_relation, status: "completed", page: 1, per_page: 1).call

        expect(result).to be_success
        imports = result.value!

        expect(imports.count).to eq(1)
        expect(imports.current_page).to eq(1)
        expect(imports.total_count).to eq(2)
        expect(imports.first.status).to eq("completed")
      end
    end

    context "with pre-filtered relation" do
      it "applies additional filters to pre-filtered relation" do
        # Start with a relation that only includes user's imports
        user_imports = Imports::Import.where(user: user)
        result = described_class.new(relation: user_imports, status: "completed", page: 1).call

        expect(result).to be_success
        imports = result.value!

        # Should only return user's completed imports
        expect(imports.count).to eq(2)
        expect(imports.map(&:id)).to contain_exactly(import1.id, import4.id)
        expect(imports.map(&:user_id)).to all(eq(user.id))
      end

      it "works with space-filtered relation" do
        # Start with a relation that only includes space's imports
        space_imports = Imports::Import.where(space: space)
        result = described_class.new(relation: space_imports, status: "pending", page: 1).call

        expect(result).to be_success
        imports = result.value!

        # Should only return space's pending imports
        expect(imports.count).to eq(1)
        expect(imports.first.id).to eq(import2.id)
        expect(imports.map(&:space_id)).to all(eq(space.id))
      end
    end
  end

  describe "private methods" do
    describe "#filter_by_status" do
      let(:base_relation) { Imports::Import.all }

      context "when status is not provided" do
        it "returns success with unchanged relation" do
          query = described_class.new(relation: base_relation)
          result = query.send(:filter_by_status, base_relation, {})

          expect(result).to be_success
          expect(result.value!).to eq(base_relation)
        end
      end

      context "when status is provided" do
        it "filters relation by status" do
          query = described_class.new(relation: base_relation, status: "completed")
          result = query.send(:filter_by_status, base_relation, { status: "completed" })

          expect(result).to be_success
          filtered_relation = result.value!
          expect(filtered_relation.count).to eq(2)
          expect(filtered_relation.map(&:id)).to contain_exactly(import1.id, import4.id)
        end
      end
    end

    describe "#order_by_recent" do
      let(:base_relation) { Imports::Import.all }

      it "orders relation by created_at descending" do
        query = described_class.new(relation: base_relation)
        result = query.send(:order_by_recent, base_relation)

        expect(result).to be_success
        ordered_relation = result.value!
        import_ids = ordered_relation.map(&:id)

        expect(import_ids.first).to eq(import2.id) # Most recent
        expect(import_ids.last).to eq(import4.id)   # Oldest
      end
    end
  end
end
