
from odoo import models, api, _


class IrFieldsConverter(models.AbstractModel):
    _inherit = 'ir.fields.converter'

    @api.model
    def _str_to_geo_multi_polygon(self, model, field, value):
        try:
            return value, []
        except ValueError:
            raise self._format_import_error(
                ValueError,
                _(u"'%s' does not seem to be a geometry for field '%%(field)s'"),
                value
            )

    @api.model
    def _str_to_geo_polygon(self, model, field, value):
        try:
            return value, []
        except ValueError:
            raise self._format_import_error(
                ValueError,
                _(u"'%s' does not seem to be a geometry for field '%%(field)s'"),
                value
            )

    @api.model
    def _str_to_geo_point(self, model, field, value):
        try:
            return value, []
        except ValueError:
            raise self._format_import_error(
                ValueError,
                _(u"'%s' does not seem to be an geometry for field '%%(field)s'"),
                value
            )
