# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Entities::Operations::CreateEntity do
  subject(:operation) { described_class.new }

  let(:space) { create(:space) }

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      full_name: "Test Entity",
      entity_type: "loan"
    }
  end

  describe '#call' do
    context 'when all params are valid' do
      it 'returns a successful result' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'returns the created entity' do
        result = operation.call(valid_params)
        entity = result.value!
        expect(entity).to be_a(Entities::Entity)
        expect(entity.full_name).to eq("Test Entity")
        expect(entity.entity_type).to eq("loan")
        expect(entity.space_id).to eq(space.id)
      end

      it 'creates a new entity' do
        expect {
          operation.call(valid_params)
        }.to change(Entities::Entity, :count).by(1)
      end

      it 'persists the entity to the database' do
        result = operation.call(valid_params)
        entity = result.value!
        expect(entity).to be_persisted
      end
    end

    context 'when validation fails' do
      let(:invalid_params) do
        {
          space_id: "",
          full_name: "",
          entity_type: "invalid"
        }
      end

      it 'returns a failure result' do
        result = operation.call(invalid_params)
        expect(result).to be_failure
      end

      it 'returns validation errors' do
        result = operation.call(invalid_params)
        expect(result.failure).to have_key(:space_id)
        expect(result.failure).to have_key(:full_name)
        expect(result.failure).to have_key(:entity_type)
      end
    end

    context 'when entity creation fails due to model validation' do
      before do
        create(:entity, space: space, full_name: "Test Entity", entity_type: "loan")
      end

      it 'returns a failure result with errors' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end

      it 'returns model validation errors' do
        result = operation.call(valid_params)
        expect(result.failure).to have_key(:errors)
      end
    end
  end

  describe '#validate' do
    context 'when valid params are provided' do
      it 'returns a successful result' do
        result = operation.send(:validate, params: valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = operation.send(:validate, params: valid_params)
        validated_params = result.value!
        expect(validated_params[:space_id]).to eq(space.id.to_s)
        expect(validated_params[:full_name]).to eq("Test Entity")
        expect(validated_params[:entity_type]).to eq("loan")
      end
    end

    context 'when space_id is missing' do
      let(:params_without_space_id) do
        valid_params.except(:space_id)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_space_id)
        expect(result).to be_failure
      end

      it 'returns space_id error' do
        result = operation.send(:validate, params: params_without_space_id)
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to include("is missing")
      end
    end

    context 'when space_id is empty' do
      let(:params_with_empty_space_id) do
        valid_params.merge(space_id: "")
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_empty_space_id)
        expect(result).to be_failure
      end

      it 'returns space_id filled error' do
        result = operation.send(:validate, params: params_with_empty_space_id)
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to include("must be filled")
      end
    end

    context 'when full_name is missing' do
      let(:params_without_full_name) do
        valid_params.except(:full_name)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_full_name)
        expect(result).to be_failure
      end

      it 'returns full_name error' do
        result = operation.send(:validate, params: params_without_full_name)
        expect(result.failure).to have_key(:full_name)
        expect(result.failure[:full_name]).to include("is missing")
      end
    end

    context 'when full_name is empty' do
      let(:params_with_empty_full_name) do
        valid_params.merge(full_name: "")
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_empty_full_name)
        expect(result).to be_failure
      end

      it 'returns full_name filled error' do
        result = operation.send(:validate, params: params_with_empty_full_name)
        expect(result.failure).to have_key(:full_name)
        expect(result.failure[:full_name]).to include("must be filled")
      end
    end

    context 'when entity_type is missing' do
      let(:params_without_entity_type) do
        valid_params.except(:entity_type)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_entity_type)
        expect(result).to be_failure
      end

      it 'returns entity_type error' do
        result = operation.send(:validate, params: params_without_entity_type)
        expect(result.failure).to have_key(:entity_type)
        expect(result.failure[:entity_type]).to include("is missing")
      end
    end

    context 'when entity_type is empty' do
      let(:params_with_empty_entity_type) do
        valid_params.merge(entity_type: "")
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_empty_entity_type)
        expect(result).to be_failure
      end

      it 'returns entity_type filled error' do
        result = operation.send(:validate, params: params_with_empty_entity_type)
        expect(result.failure).to have_key(:entity_type)
        expect(result.failure[:entity_type]).to include("must be filled")
      end
    end

    context 'when entity_type is invalid' do
      let(:params_with_invalid_entity_type) do
        valid_params.merge(entity_type: "invalid")
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_invalid_entity_type)
        expect(result).to be_failure
      end

      it 'returns entity_type validation error' do
        result = operation.send(:validate, params: params_with_invalid_entity_type)
        expect(result.failure).to have_key(:entity_type)
        expect(result.failure[:entity_type]).to include("must be one of: loan")
      end
    end

    context 'when entity_type is valid' do
      it 'accepts loan as a valid entity type' do
        result = operation.send(:validate, params: valid_params)
        expect(result).to be_success
      end
    end
  end

  describe '#create_entity' do
    context 'when entity is created successfully' do
      it 'returns a successful result' do
        result = operation.send(:create_entity, params: valid_params)
        expect(result).to be_success
      end

      it 'returns the created entity' do
        result = operation.send(:create_entity, params: valid_params)
        entity = result.value!
        expect(entity).to be_a(Entities::Entity)
        expect(entity.full_name).to eq("Test Entity")
        expect(entity.entity_type).to eq("loan")
        expect(entity.space_id).to eq(space.id)
      end

      it 'persists the entity to the database' do
        result = operation.send(:create_entity, params: valid_params)
        entity = result.value!
        expect(entity).to be_persisted
      end

      it 'creates an entity with correct attributes' do
        result = operation.send(:create_entity, params: valid_params)
        entity = result.value!
        expect(entity.space_id).to eq(space.id)
        expect(entity.full_name).to eq("Test Entity")
        expect(entity.entity_type).to eq("loan")
      end
    end

    context 'when entity creation fails due to uniqueness validation' do
      before do
        create(:entity, space: space, full_name: "Test Entity", entity_type: "loan")
      end

      it 'returns a failure result' do
        result = operation.send(:create_entity, params: valid_params)
        expect(result).to be_failure
      end

      it 'returns validation errors' do
        result = operation.send(:create_entity, params: valid_params)
        expect(result.failure).to have_key(:errors)
      end

      it 'includes error in the failure' do
        result = operation.send(:create_entity, params: valid_params)
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to be_a(ActiveRecord::RecordInvalid)
      end
    end

    context 'when entity creation fails due to missing required attributes' do
      let(:invalid_params) do
        {
          space_id: space.id.to_s,
          full_name: "",
          entity_type: "loan"
        }
      end

      it 'returns a failure result' do
        result = operation.send(:create_entity, params: invalid_params)
        expect(result).to be_failure
      end

      it 'returns validation errors' do
        result = operation.send(:create_entity, params: invalid_params)
        expect(result.failure).to have_key(:errors)
      end

      it 'includes error in the failure' do
        result = operation.send(:create_entity, params: invalid_params)
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to be_a(ActiveRecord::RecordInvalid)
      end
    end
  end
end
