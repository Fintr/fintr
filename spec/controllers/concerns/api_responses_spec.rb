# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ApiResponses do
  let(:test_controller_class) do
    Class.new(ActionController::Base) do
      include ApiResponses

      def self.name
        'TestController'
      end
    end
  end

  let(:controller_instance) { test_controller_class.new }

  before do
    allow(controller_instance).to receive(:render)
  end

  describe '#render_success' do
    context 'when data is provided' do
      let(:data) { { id: 1, name: 'Test' } }

      it 'renders success response with data and default message' do
        controller_instance.send(:render_success, data:)

        expect(controller_instance).to have_received(:render).with(
          json: {
            success: true,
            message: 'Success',
            data: {
              id: 1,
              name: 'Test'
            }
          },
          status: :ok
        )
      end

      it 'transforms keys to lower camel case' do
        controller_instance.send(:render_success, data: { user_id: 1, full_name: 'John Doe' })

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            data: hash_including(
              userId: 1,
              fullName: 'John Doe'
            )
          ),
          status: :ok
        )
      end
    end

    context 'when data is not provided' do
      it 'renders success response without data' do
        controller_instance.send(:render_success)

        expect(controller_instance).to have_received(:render).with(
          json: {
            success: true,
            message: 'Success'
          },
          status: :ok
        )
      end
    end

    context 'when custom status is provided' do
      it 'renders success response with custom status' do
        controller_instance.send(:render_success, status: :accepted)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(success: true),
          status: :accepted
        )
      end
    end

    context 'when custom message is provided' do
      it 'renders success response with custom message' do
        controller_instance.send(:render_success, message: 'Custom success message')

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Custom success message'
          ),
          status: :ok
        )
      end
    end
  end

  describe '#render_created' do
    context 'when record is provided' do
      # rubocop:disable RSpec/VerifiedDoubles
      let(:record) { double('Record', id: 123, class: double(name: 'User')) }
      # rubocop:enable RSpec/VerifiedDoubles

      before do
        allow(record.class).to receive(:name).and_return('User')
      end

      it 'renders created response with record id' do
        controller_instance.send(:render_created, record:)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Resource User created successfully',
            data: { id: 123 }
          ),
          status: :created
        )
      end

      it 'uses custom message when provided' do
        controller_instance.send(:render_created, record:, message: 'Custom message')

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Custom message',
            data: { id: 123 }
          ),
          status: :created
        )
      end

      it 'handles namespaced class names correctly' do
        # rubocop:disable RSpec/VerifiedDoubles
        namespaced_record = double('Record', id: 456, class: double(name: 'Auth::User'))
        # rubocop:enable RSpec/VerifiedDoubles
        allow(namespaced_record.class).to receive(:name).and_return('Auth::User')

        controller_instance.send(:render_created, record: namespaced_record)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Resource User created successfully',
            data: { id: 456 }
          ),
          status: :created
        )
      end
    end

    context 'when data is provided instead of record' do
      let(:data) { { id: 789, name: 'Test Resource' } }

      it 'renders created response with provided data' do
        controller_instance.send(:render_created, data:)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Resource created successfully',
            data: { id: 789, name: 'Test Resource' }
          ),
          status: :created
        )
      end

      it 'uses custom message when provided' do
        controller_instance.send(:render_created, data:, message: 'Custom creation message')

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Custom creation message',
            data: { id: 789, name: 'Test Resource' }
          ),
          status: :created
        )
      end
    end

    context 'when neither record nor data is provided' do
      it 'renders created response without data' do
        controller_instance.send(:render_created)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Resource created successfully'
          ),
          status: :created
        )
      end

      it 'uses custom message when provided' do
        controller_instance.send(:render_created, message: 'Custom message')

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Custom message'
          ),
          status: :created
        )
      end
    end

    context 'when both record and data are provided' do
      # rubocop:disable RSpec/VerifiedDoubles
      let(:record) { double('Record', id: 123, class: double(name: 'User')) }
      # rubocop:enable RSpec/VerifiedDoubles

      before do
        allow(record.class).to receive(:name).and_return('User')
      end

      it 'prefers record over data' do
        controller_instance.send(:render_created, record:, data: { id: 999 })

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: true,
            message: 'Resource User created successfully',
            data: { id: 123 }
          ),
          status: :created
        )
      end
    end
  end

  describe '#render_error' do
    context 'when details are provided' do
      let(:details) { { field: 'value', issue: 'error' } }

      it 'renders error response with message and details' do
        controller_instance.send(:render_error, message: 'Error occurred', status: :bad_request, details:)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: false,
            error: hash_including(
              message: 'Error occurred',
              details: hash_including(
                field: 'value',
                issue: 'error'
              )
            )
          ),
          status: :bad_request
        )
      end

      it 'transforms keys to lower camel case' do
        controller_instance.send(:render_error,
          message: 'Error',
          status: :bad_request,
          details: { user_id: 1, full_name: 'John' })

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: false,
            error: hash_including(
              details: hash_including(
                userId: 1,
                fullName: 'John'
              )
            )
          ),
          status: :bad_request
        )
      end
    end

    context 'when details are not provided' do
      it 'renders error response without details' do
        controller_instance.send(:render_error, message: 'Error occurred', status: :internal_server_error)

        expect(controller_instance).to have_received(:render).with(
          json: hash_including(
            success: false,
            error: hash_including(
              message: 'Error occurred'
            )
          ),
          status: :internal_server_error
        )
      end
    end
  end

  describe '#render_bad_request' do
    it 'renders bad request error with default message' do
      controller_instance.send(:render_bad_request)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Bad Request'
          )
        ),
        status: :bad_request
      )
    end

    it 'renders bad request error with custom message' do
      controller_instance.send(:render_bad_request, message: 'Custom bad request')

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Custom bad request'
          )
        ),
        status: :bad_request
      )
    end

    it 'renders bad request error with details' do
      controller_instance.send(:render_bad_request, message: 'Bad request', details: { field: 'value' })

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Bad request',
            details: hash_including(field: 'value')
          )
        ),
        status: :bad_request
      )
    end
  end

  describe '#render_unauthorized' do
    it 'renders unauthorized error with default message' do
      controller_instance.send(:render_unauthorized)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Unauthorized'
          )
        ),
        status: :unauthorized
      )
    end

    it 'renders unauthorized error with custom message' do
      controller_instance.send(:render_unauthorized, message: 'Custom unauthorized')

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Custom unauthorized'
          )
        ),
        status: :unauthorized
      )
    end

    it 'renders unauthorized error with details' do
      controller_instance.send(:render_unauthorized, details: { reason: 'token_expired' })

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Unauthorized',
            details: hash_including(reason: 'token_expired')
          )
        ),
        status: :unauthorized
      )
    end
  end

  describe '#render_forbidden' do
    it 'renders forbidden error with default message' do
      controller_instance.send(:render_forbidden)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Forbidden'
          )
        ),
        status: :forbidden
      )
    end

    it 'renders forbidden error with custom message' do
      controller_instance.send(:render_forbidden, message: 'Custom forbidden')

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Custom forbidden'
          )
        ),
        status: :forbidden
      )
    end

    it 'renders forbidden error with details' do
      controller_instance.send(:render_forbidden, details: { reason: 'insufficient_permissions' })

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Forbidden',
            details: hash_including(reason: 'insufficient_permissions')
          )
        ),
        status: :forbidden
      )
    end
  end

  describe '#render_not_found' do
    it 'renders not found error with default message' do
      controller_instance.send(:render_not_found)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Resource not found'
          )
        ),
        status: :not_found
      )
    end

    it 'renders not found error with custom message' do
      controller_instance.send(:render_not_found, message: 'Custom not found')

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Custom not found'
          )
        ),
        status: :not_found
      )
    end

    it 'renders not found error with details' do
      controller_instance.send(:render_not_found, details: { resource: 'User', id: 999 })

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Resource not found',
            details: hash_including(
              resource: 'User',
              id: 999
            )
          )
        ),
        status: :not_found
      )
    end
  end

  describe '#render_unprocessable_content' do
    it 'renders unprocessable content error with default message' do
      controller_instance.send(:render_unprocessable_content)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Unprocessable Entity'
          )
        ),
        status: :unprocessable_content
      )
    end

    it 'renders unprocessable content error with custom message' do
      controller_instance.send(:render_unprocessable_content, message: 'Custom unprocessable')

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Custom unprocessable'
          )
        ),
        status: :unprocessable_content
      )
    end

    it 'renders unprocessable content error with details' do
      controller_instance.send(:render_unprocessable_content, details: { validation_errors: ['field is required'] })

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Unprocessable Entity',
            details: hash_including(validationErrors: ['field is required'])
          )
        ),
        status: :unprocessable_content
      )
    end
  end

  describe '#render_internal_server_error' do
    it 'renders internal server error with default message' do
      controller_instance.send(:render_internal_server_error)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Internal Server Error'
          )
        ),
        status: :internal_server_error
      )
    end

    it 'renders internal server error with custom message' do
      controller_instance.send(:render_internal_server_error, message: 'Custom server error')

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Custom server error'
          )
        ),
        status: :internal_server_error
      )
    end

    it 'renders internal server error with details' do
      controller_instance.send(:render_internal_server_error, details: { error_code: 'ERR_001' })

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Internal Server Error',
            details: hash_including(errorCode: 'ERR_001')
          )
        ),
        status: :internal_server_error
      )
    end
  end

  describe '#render_validation_errors' do
    # rubocop:disable RSpec/VerifiedDoubles, RSpec/VerifiedDoubleReference
    let(:record1) { double('Record', class: double(name: 'User'), errors: instance_double('Errors')) }
    let(:record2) { double('Record', class: double(name: 'Profile'), errors: instance_double('Errors')) }
    # rubocop:enable RSpec/VerifiedDoubles, RSpec/VerifiedDoubleReference

    before do
      allow(record1.class).to receive(:name).and_return('User')
      allow(record2.class).to receive(:name).and_return('Profile')
      allow(record1.errors).to receive(:to_hash).and_return({ email: ['is invalid'], name: ['can\'t be blank'] })
      allow(record2.errors).to receive(:to_hash).and_return({ age: ['must be positive'] })
    end

    it 'renders validation errors for a single record' do
      controller_instance.send(:render_validation_errors, record1)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Validation Failed',
            details: hash_including(
              user: record1.errors
            )
          )
        ),
        status: :unprocessable_content
      )
    end

    it 'renders validation errors for multiple records' do
      controller_instance.send(:render_validation_errors, record1, record2)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Validation Failed',
            details: hash_including(
              user: record1.errors,
              profile: record2.errors
            )
          )
        ),
        status: :unprocessable_content
      )
    end

    it 'handles namespaced class names correctly' do
      # rubocop:disable RSpec/VerifiedDoubles, RSpec/VerifiedDoubleReference
      namespaced_record = double('Record', class: double(name: 'Auth::User'), errors: instance_double('Errors'))
      # rubocop:enable RSpec/VerifiedDoubles, RSpec/VerifiedDoubleReference
      allow(namespaced_record.class).to receive(:name).and_return('Auth::User')
      allow(namespaced_record.errors).to receive(:to_hash).and_return({})

      controller_instance.send(:render_validation_errors, namespaced_record)

      expect(controller_instance).to have_received(:render).with(
        json: hash_including(
          success: false,
          error: hash_including(
            message: 'Validation Failed',
            details: hash_including(
              user: namespaced_record.errors
            )
          )
        ),
        status: :unprocessable_content
      )
    end
  end
end
