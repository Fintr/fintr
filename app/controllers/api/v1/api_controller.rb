# frozen_string_literal: true

module Api
  module V1
    class ApiController < ApplicationController
      include Secured

      before_action :authorize
    end
  end
end
