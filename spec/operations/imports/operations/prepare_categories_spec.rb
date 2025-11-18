# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Imports::Operations::PrepareCategories do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) do
    Imports::Import.create!(
      user: user,
      space: space,
      import_location: 'settings',
      status: 'pending'
    )
  end

  let(:rows_data) do
    [
      {
        data: [
          nil,
          nil,
          nil,
          'expense',
          'Groceries',
          nil
        ]
      },
      {
        data: [
          nil,
          nil,
          nil,
          'income',
          'Salary',
          nil
        ]
      },
      {
        data: [
          nil,
          nil,
          nil,
          'expense',
          'Groceries',
          nil
        ]
      }
    ]
  end

  let(:valid_params) do
    {
      space_id: space.id,
      rows_data: rows_data,
      import: import
    }
  end

  before do
    allow(Rails.logger).to receive(:error)
  end

  describe '#call' do
    context 'when rows_data is valid' do
      it 'returns success' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'returns category_map and new_categories' do
        result = operation.call(valid_params)
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value).to have_key(:category_map)
        expect(value).to have_key(:new_categories)
      end

      it 'creates missing categories' do
        # Use a fresh space to avoid transaction issues
        fresh_space = create(:personal_space, users: [user])
        fresh_params = {
          space_id: fresh_space.id,
          rows_data: rows_data,
          import: nil
        }
        initial_count = Transactions::Category.where(space: fresh_space).count
        result = operation.call(fresh_params)
        expect(result).to be_success
        expect(Transactions::Category.where(space: fresh_space).count).to eq(initial_count + 2)
      end

      it 'creates category import records when import is provided' do
        # Use a fresh space and import to avoid transaction issues
        fresh_space = create(:personal_space, users: [user])
        fresh_import = Imports::Import.create!(
          user: user,
          space: fresh_space,
          import_location: 'settings',
          status: 'pending'
        )
        fresh_params = {
          space_id: fresh_space.id,
          rows_data: rows_data,
          import: fresh_import
        }

        result = operation.call(fresh_params)
        expect(result).to be_success
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:new_categories].length).to eq(2)
        # Verify import records were created
        expect(Imports::ImportRecord.where(import: fresh_import).count).to eq(2)
      end

      it 'does not create duplicate categories' do
        # Use a fresh space to avoid transaction issues
        fresh_space = create(:personal_space, users: [user])
        fresh_import = Imports::Import.create!(
          user: user,
          space: fresh_space,
          import_location: 'settings',
          status: 'pending'
        )

        # Pre-create the categories that would be created by the operation
        # This simulates calling the operation once, then calling it again
        create(
          :category,
          space: fresh_space,
          name: 'Groceries',
          category_type: 'expense'
        )
        create(
          :category,
          space: fresh_space,
          name: 'Salary',
          category_type: 'income'
        )

        fresh_rows_data = [
          {
            data: [
              nil,
              nil,
              nil,
              'expense',
              'Groceries',
              nil
            ]
          },
          {
            data: [
              nil,
              nil,
              nil,
              'income',
              'Salary',
              nil
            ]
          }
        ]
        fresh_params = {
          space_id: fresh_space.id,
          rows_data: fresh_rows_data,
          import: fresh_import
        }

        # Call operation - should not create new categories since they already exist
        result = operation.call(fresh_params)
        expect(result).to be_success
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        count = value[:new_categories].length

        expect(count).to eq(0)

        # Verify categories still exist and weren't duplicated
        expect(Transactions::Category.where(space: fresh_space, name: 'Groceries', category_type: 'expense').count).to eq(1)
        expect(Transactions::Category.where(space: fresh_space, name: 'Salary', category_type: 'income').count).to eq(1)
      end

      it 'builds correct category map' do
        result = operation.call(valid_params)
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        category_map = value[:category_map]

        expect(category_map).to be_a(Hash)
        expect(category_map.keys).to include('expense:Groceries', 'income:Salary')
        expect(category_map['expense:Groceries']).to be_a(Transactions::Category)
        expect(category_map['income:Salary']).to be_a(Transactions::Category)
      end
    end

    context 'when rows_data is not an array' do
      let(:invalid_params) { valid_params.merge(rows_data: 'not an array') }

      it 'returns failure' do
        result = operation.call(invalid_params)
        # The operation returns Failure directly, but it might be wrapped
        if result.success?
          expect(result.value!).to be_a(Dry::Monads::Result::Failure)
        else
          expect(result).to be_failure
        end
      end

      it 'returns error message' do
        result = operation.call(invalid_params)
        if result.success?
          failure = result.value!
          failure = failure.failure if failure.is_a?(Dry::Monads::Result::Failure)
          expect(failure[:error]).to eq('Invalid file data: rows_data must be an array')
        else
          failure = result.failure
          expect(failure[:error]).to eq('Invalid file data: rows_data must be an array')
        end
      end
    end

    context 'when rows_data is empty' do
      let(:empty_params) { valid_params.merge(rows_data: []) }

      it 'returns success' do
        result = operation.call(empty_params)
        expect(result).to be_success
      end

      it 'returns empty category_map and new_categories' do
        result = operation.call(empty_params)
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:category_map]).to eq({})
        expect(value[:new_categories]).to eq([])
      end

      it 'does not create any categories' do
        expect { operation.call(empty_params) }.not_to change(Transactions::Category, :count)
      end
    end

    context 'when categories already exist' do
      let!(:existing_category1) do
        create(
          :category,
          space: space,
          name: 'Groceries',
          category_type: 'expense'
        )
      end
      let!(:existing_category2) do
        create(
          :category,
          space: space,
          name: 'Salary',
          category_type: 'income'
        )
      end

      it 'returns success' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'does not create duplicate categories' do
        expect { operation.call(valid_params) }.not_to change(Transactions::Category, :count)
      end

      it 'uses existing categories in the map' do
        result = operation.call(valid_params)
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        category_map = value[:category_map]

        expect(category_map['expense:Groceries'].id).to eq(existing_category1.id)
        expect(category_map['income:Salary'].id).to eq(existing_category2.id)
      end

      it 'does not create import records for existing categories' do
        expect { operation.call(valid_params) }.not_to change(Imports::ImportRecord, :count)
      end
    end

    context 'when import is not provided' do
      let(:params_without_import) { valid_params.except(:import) }

      it 'returns success' do
        result = operation.call(params_without_import)
        expect(result).to be_success
      end

      it 'creates categories' do
        expect { operation.call(params_without_import) }.to change(Transactions::Category, :count).by(2)
      end

      it 'does not create import records' do
        expect { operation.call(params_without_import) }.not_to change(Imports::ImportRecord, :count)
      end
    end

    context 'when rows have blank category names or types' do
      let(:rows_with_blanks) do
        [
          {
            data: [
              nil,
              nil,
              nil,
              'expense',
              'Groceries',
              nil
            ]
          },
          {
            data: [
              nil,
              nil,
              nil,
              '',
              'Salary',
              nil
            ]
          },
          {
            data: [
              nil,
              nil,
              nil,
              'income',
              '',
              nil
            ]
          },
          {
            data: [
              nil,
              nil,
              nil,
              nil,
              nil,
              nil
            ]
          }
        ]
      end
      let(:params_with_blanks) { valid_params.merge(rows_data: rows_with_blanks) }

      it 'ignores rows with blank category names or types' do
        result = operation.call(params_with_blanks)
        expect(result).to be_success
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:category_map].keys).to eq(['expense:Groceries'])
      end
    end

    context 'when category names have whitespace' do
      let(:rows_with_whitespace) do
        [
          {
            data: [
              nil,
              nil,
              nil,
              'expense',
              '  Groceries  ',
              nil
            ]
          }
        ]
      end
      let(:params_with_whitespace) { valid_params.merge(rows_data: rows_with_whitespace) }

      it 'strips whitespace from category names' do
        result = operation.call(params_with_whitespace)
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        category_map = value[:category_map]

        expect(category_map.keys).to include('expense:Groceries')
        expect(category_map['expense:Groceries'].name).to eq('Groceries')
      end
    end

    context 'when category types have different cases' do
      let(:rows_with_mixed_case) do
        [
          {
            data: [
              nil,
              nil,
              nil,
              'EXPENSE',
              'Groceries',
              nil
            ]
          },
          {
            data: [
              nil,
              nil,
              nil,
              'Income',
              'Salary',
              nil
            ]
          }
        ]
      end
      let(:params_with_mixed_case) { valid_params.merge(rows_data: rows_with_mixed_case) }

      it 'normalizes category types to lowercase' do
        result = operation.call(params_with_mixed_case)
        value = result.value!
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        category_map = value[:category_map]

        expect(category_map.keys).to include('expense:Groceries', 'income:Salary')
        expect(category_map['expense:Groceries'].category_type).to eq('expense')
        expect(category_map['income:Salary'].category_type).to eq('income')
      end
    end
  end

  describe 'private methods' do
    describe '#extract_unique_categories' do
      it 'extracts unique categories from rows_data' do
        result = operation.send(:extract_unique_categories, rows_data: rows_data)

        expect(result).to be_an(Array)
        expect(result.length).to eq(2)
        expect(result.map { |c| c[:name] }).to contain_exactly('Groceries', 'Salary')
        expect(result.map { |c| c[:category_type] }).to contain_exactly('expense', 'income')
      end

      it 'removes duplicates' do
        result = operation.send(:extract_unique_categories, rows_data: rows_data)

        groceries_count = result.count { |c| c[:name] == 'Groceries' }
        expect(groceries_count).to eq(1)
      end

      it 'ignores rows with blank category names' do
        rows_with_blank = rows_data + [
          {
            data: [
              nil,
              nil,
              nil,
              'expense',
              '',
              nil
            ]
          }
        ]

        result = operation.send(:extract_unique_categories, rows_data: rows_with_blank)
        expect(result.length).to eq(2)
      end

      it 'ignores rows with blank category types' do
        rows_with_blank = rows_data + [
          {
            data: [
              nil,
              nil,
              nil,
              '',
              'New Category',
              nil
            ]
          }
        ]

        result = operation.send(:extract_unique_categories, rows_data: rows_with_blank)
        expect(result.length).to eq(2)
      end
    end

    describe '#find_existing_categories' do
      let!(:existing_category) do
        create(
          :category,
          space: space,
          name: 'Groceries',
          category_type: 'expense'
        )
      end

      let(:unique_categories) do
        [
          { name: 'Groceries', category_type: 'expense' },
          { name: 'Salary', category_type: 'income' }
        ]
      end

      it 'finds existing categories' do
        result = operation.send(
          :find_existing_categories,
          space_id: space.id,
          unique_categories: unique_categories
        )

        expect(result).to include(existing_category)
        expect(result.length).to eq(1)
      end

      it 'returns empty array when no categories exist' do
        result = operation.send(
          :find_existing_categories,
          space_id: space.id,
          unique_categories: [
            { name: 'New Category', category_type: 'expense' }
          ]
        )

        expect(result).to be_empty
      end

      it 'returns empty array when unique_categories is empty' do
        result = operation.send(
          :find_existing_categories,
          space_id: space.id,
          unique_categories: []
        )

        expect(result).to be_empty
      end
    end

    describe '#create_missing_categories' do
      let(:unique_categories) do
        [
          { name: 'Groceries', category_type: 'expense' },
          { name: 'Salary', category_type: 'income' }
        ]
      end

      context 'when no categories exist' do
        let(:existing_categories) { [] }

        it 'creates all categories' do
          result = operation.send(
            :create_missing_categories,
            space_id: space.id,
            unique_categories: unique_categories,
            existing_categories: existing_categories
          )

          expect(result.length).to eq(2)
          expect(result.map(&:name)).to contain_exactly('Groceries', 'Salary')
        end

        it 'creates categories with correct attributes' do
          result = operation.send(
            :create_missing_categories,
            space_id: space.id,
            unique_categories: unique_categories,
            existing_categories: existing_categories
          )

          groceries = result.find { |c| c.name == 'Groceries' }
          salary = result.find { |c| c.name == 'Salary' }

          expect(groceries.space_id).to eq(space.id)
          expect(groceries.category_type).to eq('expense')
          expect(salary.space_id).to eq(space.id)
          expect(salary.category_type).to eq('income')
        end
      end

      context 'when some categories exist' do
        let!(:existing_category) do
          create(
            :category,
            space: space,
            name: 'Groceries',
            category_type: 'expense'
          )
        end
        let(:existing_categories) { [existing_category] }

        it 'creates only missing categories' do
          result = operation.send(
            :create_missing_categories,
            space_id: space.id,
            unique_categories: unique_categories,
            existing_categories: existing_categories
          )

          expect(result.length).to eq(1)
          expect(result.first.name).to eq('Salary')
        end
      end

      context 'when all categories exist' do
        let!(:existing_category1) do
          create(
            :category,
            space: space,
            name: 'Groceries',
            category_type: 'expense'
          )
        end
        let!(:existing_category2) do
          create(
            :category,
            space: space,
            name: 'Salary',
            category_type: 'income'
          )
        end
        let(:existing_categories) { [existing_category1, existing_category2] }

        it 'returns empty array' do
          result = operation.send(
            :create_missing_categories,
            space_id: space.id,
            unique_categories: unique_categories,
            existing_categories: existing_categories
          )

          expect(result).to be_empty
        end
      end

      context 'when bulk import fails and retry succeeds' do
        let(:existing_categories) { [] }

        before do
          allow(Transactions::Category).to receive(:import).and_raise(ActiveRecord::StatementInvalid.new('Database error'))
        end

        it 'falls back to individual creation' do
          result = operation.send(
            :create_missing_categories,
            space_id: space.id,
            unique_categories: unique_categories,
            existing_categories: existing_categories
          )

          expect(result.length).to eq(2)
          expect(result.map(&:name)).to contain_exactly('Groceries', 'Salary')
        end
      end

      context 'when retry encounters race condition' do
        let(:existing_categories) { [] }
        let!(:race_category) do
          create(
            :category,
            space: space,
            name: 'Groceries',
            category_type: 'expense'
          )
        end

        let!(:salary_category) do
          create(
            :category,
            space: space,
            name: 'Salary',
            category_type: 'income'
          )
        end

        before do
          call_count = 0
          allow(Transactions::Category).to receive(:import) do
            call_count += 1
            raise ActiveRecord::StatementInvalid.new('Database error') if call_count == 1
          end
          allow(Transactions::Category).to receive(:create!) do |args|
            if args[:name] == 'Groceries'
              raise ActiveRecord::RecordNotUnique.new('Duplicate')
            else
              salary_category
            end
          end
          allow(Transactions::Category).to receive(:find_by!) do |args|
            if args[:name] == 'Groceries'
              race_category
            else
              salary_category
            end
          end
        end

        it 'handles race condition by finding existing category' do
          result = operation.send(
            :create_missing_categories,
            space_id: space.id,
            unique_categories: unique_categories,
            existing_categories: existing_categories
          )

          expect(result.length).to eq(2)
          expect(result.map(&:name)).to contain_exactly('Groceries', 'Salary')
          expect(result.find { |c| c.name == 'Groceries' }.id).to eq(race_category.id)
          expect(result.find { |c| c.name == 'Salary' }.id).to eq(salary_category.id)
        end
      end
    end

    describe '#build_category_map' do
      let(:existing_category) do
        create(
          :category,
          space: space,
          name: 'Groceries',
          category_type: 'expense'
        )
      end
      let(:new_category) do
        create(
          :category,
          space: space,
          name: 'Salary',
          category_type: 'income'
        )
      end

      it 'builds map from existing and new categories' do
        result = operation.send(
          :build_category_map,
          existing_categories: [existing_category],
          new_categories: [new_category]
        )

        expect(result).to be_a(Hash)
        expect(result.keys).to include('expense:Groceries', 'income:Salary')
        expect(result['expense:Groceries']).to eq(existing_category)
        expect(result['income:Salary']).to eq(new_category)
      end

      it 'uses correct key format' do
        result = operation.send(
          :build_category_map,
          existing_categories: [existing_category],
          new_categories: [new_category]
        )

        expect(result.keys).to all(match(/\w+:\w+/))
      end
    end

    describe '#create_category_import_records' do
      let(:test_import) do
        Imports::Import.create!(
          user: user,
          space: space,
          import_location: 'settings',
          status: 'pending'
        )
      end

      let(:new_categories) do
        [
          create(
            :category,
            space: space,
            name: 'Groceries',
            category_type: 'expense'
          ),
          create(
            :category,
            space: space,
            name: 'Salary',
            category_type: 'income'
          )
        ]
      end

      context 'when new_categories is not empty' do
        it 'creates import records for new categories' do
          # Use a fresh space and import to avoid transaction issues
          fresh_space = create(:personal_space, users: [user])
          fresh_import = Imports::Import.create!(
            user: user,
            space: fresh_space,
            import_location: 'settings',
            status: 'pending'
          )
          fresh_categories = [
            create(
              :category,
              space: fresh_space,
              name: 'Groceries',
              category_type: 'expense'
            ),
            create(
              :category,
              space: fresh_space,
              name: 'Salary',
              category_type: 'income'
            )
          ]

          # Call the method and verify it creates import records
          expect do
            operation.send(
              :create_category_import_records,
              import: fresh_import,
              new_categories: fresh_categories
            )
          end.to change { Imports::ImportRecord.where(import: fresh_import).count }.by(2)
        end

        it 'creates import records with correct attributes' do
          # Use a fresh space and import to avoid transaction issues
          fresh_space = create(:personal_space, users: [user])
          fresh_import = Imports::Import.create!(
            user: user,
            space: fresh_space,
            import_location: 'settings',
            status: 'pending'
          )
          fresh_categories = [
            create(
              :category,
              space: fresh_space,
              name: 'Groceries',
              category_type: 'expense'
            ),
            create(
              :category,
              space: fresh_space,
              name: 'Salary',
              category_type: 'income'
            )
          ]

          operation.send(
            :create_category_import_records,
            import: fresh_import,
            new_categories: fresh_categories
          )

          # Verify import records were created with correct attributes
          import_records = Imports::ImportRecord.where(import: fresh_import, record_type: 'Transactions::Category').order(:created_at).last(2)
          expect(import_records.map(&:import)).to all(eq(fresh_import))
          expect(import_records.map(&:status)).to all(eq('success'))
          expect(import_records.map(&:record_type)).to all(eq('Transactions::Category'))
          expect(import_records.map(&:record_id)).to match_array(fresh_categories.map(&:id))
        end
      end

      context 'when new_categories is empty' do
        it 'does not create import records' do
          initial_count = Imports::ImportRecord.count
          operation.send(
            :create_category_import_records,
            import: test_import,
            new_categories: []
          )
          expect(Imports::ImportRecord.count).to eq(initial_count)
        end
      end

      context 'when bulk import fails' do
        before do
          allow(Imports::ImportRecord).to receive(:import).and_raise(StandardError.new('Import failed'))
        end

        it 'logs error and continues' do
          expect(Rails.logger).to receive(:error)
          expect do
            operation.send(
              :create_category_import_records,
              import: test_import,
              new_categories: new_categories
            )
          end.not_to raise_error
        end

        it 'does not create import records' do
          initial_count = Imports::ImportRecord.count
          operation.send(
            :create_category_import_records,
            import: test_import,
            new_categories: new_categories
          )
          expect(Imports::ImportRecord.count).to eq(initial_count)
        end
      end
    end
  end
end
