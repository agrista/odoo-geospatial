# Copyright 2015 ACSONE SA/NV (<http://acsone.eu>)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html).

from odoo import api, fields, models


class ResPartner(models.Model):
    """Add location to partner using a function field"""

    _inherit = "res.partner"

    @api.depends("partner_latitude", "partner_longitude")
    def _compute_location(self):
        """
        Set the `location` of the partner depending of its `partner_latitude`
        and its `partner_longitude`
        **Notes**
        If one of those parameters is not set then reset the partner's
        location and do not recompute it
        """
        for rec in self:
            if not rec.partner_latitude or not rec.partner_longitude:
                rec.location = False
            else:
                rec.location = fields.GeoPoint.from_latlon(
                    rec.env.cr, rec.partner_latitude, rec.partner_longitude
                )

    location = fields.GeoPoint(
        store=True, compute="_compute_location", inverse="_inverse_location", srid=4326
    )

    def _inverse_location(self):
        for rec in self:
            if not rec.location:
                rec.partner_longitude, rec.partner_latitude = False, False
            else:
                (
                    rec.partner_longitude,
                    rec.partner_latitude,
                ) = fields.GeoPoint.to_latlon(rec.env.cr, rec.location)
