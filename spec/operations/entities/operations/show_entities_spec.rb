# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'

RSpec.describe Entities::Operations::ShowEntities do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) }
  let!(:space) { create(:space) }
  let(:valid_params) { { space_id: space.id.to_s } }

  let(:mock_entities) { [create(:entity, space: space, full_name: 'Test Entity')] }
  let(:mock_all_entities_query) { instance_double(Entities::Queries::AllEntities) }

  describe '#validate' do
    context 'when valid params' do
      it 'returns a successful result' do
        result = operation.validate(params: valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = operation.validate(params: valid_params)
        expect(result.value!).to eq(valid_params)
      end

      context 'with optional params' do
        let(:params_with_optional) { { space_id: space.id.to_s, entity_type: 'loan', search: 'test' } }

        it 'returns a successful result' do
          result = operation.validate(params: params_with_optional)
          expect(result).to be_success
        end

        it 'returns the validated params including optional ones' do
          result = operation.validate(params: params_with_optional)
          expect(result.value!).to eq(params_with_optional)
        end
      end
    end

    context 'when invalid params' do
      it 'returns a failure result when space_id is missing' do
        invalid_params = { entity_type: 'loan' }
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ['is missing'])
      end

      it 'returns a failure result when space_id is not a string' do
        invalid_params = { space_id: 123 }
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
      end
    end
  end

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    let(:params) { valid_params }

    before do
      allow(Entities::Queries::AllEntities).to receive(:new).and_return(mock_all_entities_query)
      allow(mock_all_entities_query).to receive(:call).and_return(Dry::Monads::Success(mock_entities))
    end

    context 'with valid parameters' do
      it { is_expected.to be_success }

      it 'returns the entities from the query' do
        result = call_operation.value!
        expect(result).to eq(mock_entities)
      end

      it 'calls AllEntities query with correct parameters' do
        call_operation
        expect(Entities::Queries::AllEntities).to have_received(:new).with(params: valid_params)
        expect(mock_all_entities_query).to have_received(:call)
      end

      context 'with optional entity_type parameter' do
        let(:params) { { space_id: space.id.to_s, entity_type: 'loan' } }

        it { is_expected.to be_success }

        it 'calls AllEntities query with entity_type parameter' do
          call_operation
          expect(Entities::Queries::AllEntities).to have_received(:new).with(params: params)
        end
      end

      context 'with optional search parameter' do
        let(:params) { { space_id: space.id.to_s, search: 'test' } }

        it { is_expected.to be_success }

        it 'calls AllEntities query with search parameter' do
          call_operation
          expect(Entities::Queries::AllEntities).to have_received(:new).with(params: params)
        end
      end

      context 'with all optional parameters' do
        let(:params) { { space_id: space.id.to_s, entity_type: 'loan', search: 'test' } }

        it { is_expected.to be_success }

        it 'calls AllEntities query with all parameters' do
          call_operation
          expect(Entities::Queries::AllEntities).to have_received(:new).with(params: params)
        end
      end
    end

    describe 'Validation Failures' do
      context 'when space_id is missing' do
        let(:params) { { entity_type: 'loan' } }

        it { is_expected.to be_failure }

        it 'returns space_id missing error' do
          expect(call_operation.failure).to include(space_id: ['is missing'])
        end
      end
    end

    describe 'Dependency Failures' do
      context 'when AllEntities query fails' do
        let(:params) { valid_params }

        before do
          allow(mock_all_entities_query).to receive(:call).and_return(Dry::Monads::Failure({ query: 'Query failed' }))
        end

        it { is_expected.to be_failure }

        it 'returns an error when trying to unwrap the failure' do
          failure = call_operation.failure
          expect(failure[:error]).to be_a(Dry::Monads::UnwrapError)
        end
      end

      context 'when AllEntities query raises an error' do
        let(:params) { valid_params }
        let(:error_message) { 'Database error' }

        before do
          allow(mock_all_entities_query).to receive(:call).and_raise(StandardError.new(error_message))
        end

        it { is_expected.to be_failure }

        it 'returns the error' do
          failure = call_operation.failure
          expect(failure[:error]).to be_a(StandardError)
          expect(failure[:error].message).to eq(error_message)
        end
      end
    end
  end
end
