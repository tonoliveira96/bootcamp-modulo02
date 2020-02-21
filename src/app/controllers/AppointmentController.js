import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointment = await Appointment.findAll({
      where: { user_id: req.userID, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointment);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'validation fails' });
    }

    const { provider_id, date } = req.body;

    // check if "provider_id" is a provider
    const isProvider = await User.findOne({
      where: {
        id: provider_id,
        provider: true,
      },
    });
    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only create appointments with providers' });
    }

    // check for past dates
    const hourStart = startOfHour(parseISO(date));
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permited' });
    }

    // check for availability
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });
    if (checkAvailability) {
      return res
        .status(400)
        .json({ error: 'Appointment date is not available' });
    }

    // check appointment saved between providers
    const providerToProvider = await User.findOne({
      where: {
        id: req.userID,
        provider: true,
      },
    });
    if (providerToProvider) {
      return res
        .status(400)
        .json({ error: 'Appointmente between provider not allowed' });
    }

    // check same provider
    // const sameProvider = await User.findOne({
    //   where: {
    //     id: req.userID,
    //     provider: true,
    //   },
    // });
    // if (sameProvider) {
    //   return res.status(400).json({ error: 'You cant appointment yourself' });
    // }

    // save appointment
    const appointment = await Appointment.create({
      user_id: req.userID,
      provider_id,
      date: hourStart,
    });

    // notify appointment provider
    const user = await User.findByPk(req.userID);
    const formatteddate = format(
      hourStart,
      "'dia' dd 'de' MMMM', as' H:mm'h'",
      {
        locale: pt,
      }
    );
    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formatteddate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id);

    if (appointment.user_id !== req.userID) {
      return res.status(400).json({
        error: "You don't have permission to cancel this appointment",
      });
    }
    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res
        .status(401)
        .json({ error: 'You can only cancel appointment 2 hours in advence' });
    }

    appointment.canceled_at = Date();

    await appointment.save();

    return res.json(appointment);
  }
}

export default new AppointmentController();
