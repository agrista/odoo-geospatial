# Copyright 2011-2020 Camptocamp SA
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl)

from odoo import fields, models


class ResPartner(models.Model):
    """Add location to partner using a function filed"""

    _inherit = "res.partner"

    location = fields.GeoPoint("Location", srid=4326)
