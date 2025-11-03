# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FailureHandler do
  let(:test_class) do
    Class.new do
      include FailureHandler
    end
  end

  let(:instance) { test_class.new }

  describe '#on_failure' do
    context 'when failure is a Hash with an error key' do
      let(:test_error) { StandardError.new('Test error message') }
      let(:failure) do
        {
          field_1: 'error 1',
          field_2: 'error 2',
          error: test_error
        }
      end

      before do
        allow(Rails.logger).to receive(:error)
        allow(Sentry).to receive(:capture_exception)
      end

      it 'logs the error with Rails logger' do
        instance.on_failure(failure)

        expect(Rails.logger).to have_received(:error).with(
          "[#{test_class.name}] #{{
            errors: {
              field_1: 'error 1',
              field_2: 'error 2'
            },
            error: test_error
          }}"
        )
      end

      it 'captures the exception with Sentry' do
        instance.on_failure(failure)

        expect(Sentry).to have_received(:capture_exception).with(test_error)
      end
    end

    context 'when failure does not include an error key' do
      let(:failure) do
        {
          field_1: 'error 1',
          field_2: 'error 2'
        }
      end

      before do
        allow(Rails.logger).to receive(:error)
        allow(Sentry).to receive(:capture_exception)
      end

      it 'logs the error with Rails logger without an error field' do
        instance.on_failure(failure)

        expect(Rails.logger).to have_received(:error).with(
          "[#{test_class.name}] #{{
            errors: {
              field_1: 'error 1',
              field_2: 'error 2'
            },
            error: nil
          }}"
        )
      end

      it 'does not capture an exception with Sentry' do
        instance.on_failure(failure)

        expect(Sentry).not_to have_received(:capture_exception)
      end
    end

    context 'when failure is not a Hash' do
      let(:failure) { 'string failure' }

      it 'raises a NoMatchingPatternError' do
        expect { instance.on_failure(failure) }.to raise_error(NoMatchingPatternError)
      end
    end
  end
end
